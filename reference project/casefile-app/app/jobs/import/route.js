import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEIRSTACK_URL =
  "https://api.theirstack.com/v1/jobs/search";

function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIndeedHost(hostname = "") {
  const host = hostname
    .toLowerCase()
    .replace(/^www\./, "");

  return (
    host === "indeed.com" ||
    host.endsWith(".indeed.com")
  );
}

function normalizeIndeedUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      "Please enter a valid Indeed job URL."
    );
  }

  if (!isIndeedHost(url.hostname)) {
    throw new Error(
      "This importer currently supports Indeed URLs only."
    );
  }

  const jobKey =
    url.searchParams.get("jk");

  if (!jobKey) {
    throw new Error(
      "This Indeed URL does not contain a job key (jk)."
    );
  }

  return {
    jobKey,

    url:
      `https://${url.hostname}/viewjob?jk=${encodeURIComponent(
        jobKey
      )}`
  };
}

function getIndeedJobKey(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    const url =
      new URL(rawUrl);

    if (!isIndeedHost(url.hostname)) {
      return "";
    }

    return clean(
      url.searchParams.get("jk")
    );
  } catch {
    return "";
  }
}

function countryFromIndeedHost(rawUrl) {
  try {
    const host =
      new URL(rawUrl)
        .hostname
        .toLowerCase();

    if (host.startsWith("ca.")) {
      return "CA";
    }

    if (
      host.startsWith("uk.") ||
      host.startsWith("gb.")
    ) {
      return "GB";
    }

    if (host.startsWith("au.")) {
      return "AU";
    }

    if (host.startsWith("nz.")) {
      return "NZ";
    }

    return "";
  } catch {
    return "";
  }
}

function getCompany(job) {
  if (
    typeof job?.company === "string" &&
    job.company.trim()
  ) {
    return job.company.trim();
  }

  if (
    typeof job?.company_name === "string" &&
    job.company_name.trim()
  ) {
    return job.company_name.trim();
  }

  if (
    typeof job?.company_object?.name ===
      "string" &&
    job.company_object.name.trim()
  ) {
    return job.company_object.name.trim();
  }

  return "";
}

function getTitle(job) {
  return clean(
    job?.job_title ||
    job?.title
  );
}

function getLocation(job) {
  return clean(
    job?.location ||
    job?.long_location ||
    job?.short_location ||
    job?.location_raw
  );
}

function containsSameIndeedKey(
  candidateUrl,
  expectedKey
) {
  if (
    !candidateUrl ||
    !expectedKey
  ) {
    return false;
  }

  return (
    getIndeedJobKey(candidateUrl) ===
    expectedKey
  );
}

function tokenSimilarity(a, b) {
  const left =
    new Set(
      normalize(a)
        .split(" ")
        .filter(Boolean)
    );

  const right =
    new Set(
      normalize(b)
        .split(" ")
        .filter(Boolean)
    );

  if (
    !left.size ||
    !right.size
  ) {
    return 0;
  }

  let common = 0;

  for (const token of left) {
    if (right.has(token)) {
      common += 1;
    }
  }

  return (
    common /
    Math.max(
      left.size,
      right.size
    )
  );
}

function sameCompany(
  candidate,
  hint
) {
  const a =
    normalize(candidate);

  const b =
    normalize(hint);

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  return (
    (
      a.length >= 4 &&
      b.includes(a)
    ) ||
    (
      b.length >= 4 &&
      a.includes(b)
    )
  );
}

function descriptionContainsCompany(
  job,
  companyHint
) {
  const description =
    normalize(
      job?.description || ""
    );

  const company =
    normalize(companyHint);

  if (
    !description ||
    !company
  ) {
    return false;
  }

  return description.includes(
    company
  );
}

function findBestMatch(
  jobs,
  {
    jobKey,
    companyHint,
    positionHint
  }
) {
  /*
   * Strongest possible match:
   * returned URL contains the exact
   * Indeed jk supplied by the user.
   */
  const exactUrlMatch =
    jobs.find(job => {
      return (
        containsSameIndeedKey(
          job?.source_url,
          jobKey
        ) ||
        containsSameIndeedKey(
          job?.url,
          jobKey
        ) ||
        containsSameIndeedKey(
          job?.final_url,
          jobKey
        )
      );
    });

  if (exactUrlMatch) {
    return {
      job:
        exactUrlMatch,

      matchType:
        "exact-indeed-url"
    };
  }

  /*
   * Don't guess without both hints.
   */
  if (
    !clean(companyHint) ||
    !clean(positionHint)
  ) {
    return null;
  }

  const candidates =
    jobs.map(job => {
      const company =
        getCompany(job);

      const title =
        getTitle(job);

      const titleScore =
        tokenSimilarity(
          title,
          positionHint
        );

      const companyMatches =
        sameCompany(
          company,
          companyHint
        );

      const companyInDescription =
        descriptionContainsCompany(
          job,
          companyHint
        );

      return {
        job,
        company,
        title,
        titleScore,
        companyMatches,
        companyInDescription
      };
    });

  console.log(
    "[TheirStack import] candidates:",
    candidates.map(item => ({
      company:
        item.company,

      title:
        item.title,

      titleScore:
        item.titleScore,

      companyMatches:
        item.companyMatches,

      companyInDescription:
        item.companyInDescription,

      source_url:
        item.job?.source_url,

      url:
        item.job?.url
    }))
  );

  /*
   * Require a strong title match,
   * plus either company-field match
   * or company name appearing in
   * the description.
   */
  const strongMatches =
    candidates.filter(item => {
      return (
        item.titleScore >= 0.8 &&
        (
          item.companyMatches ||
          item.companyInDescription
        )
      );
    });

  if (
    strongMatches.length === 1
  ) {
    return {
      job:
        strongMatches[0].job,

      matchType:
        strongMatches[0]
          .companyMatches
          ? "company-title"
          : "description-company-title"
    };
  }

  /*
   * Multiple copies can sometimes
   * represent the same posting.
   */
  if (
    strongMatches.length > 1
  ) {
    const signatures =
      new Set(
        strongMatches.map(item => {
          return [
            normalize(
              item.company
            ),

            normalize(
              item.title
            ),

            normalize(
              getLocation(
                item.job
              )
            )
          ].join("|");
        })
      );

    if (
      signatures.size === 1
    ) {
      return {
        job:
          strongMatches[0].job,

        matchType:
          "duplicate-company-title"
      };
    }
  }

  /*
   * Ambiguous = reject.
   */
  return null;
}

function extractRequisitionId(
  description = ""
) {
  const patterns = [
    /(?:^|\n)\s*requisition\s+id\s*[:#-]\s*([A-Z0-9][A-Z0-9._/-]*)/im,

    /(?:^|\n)\s*requisition\s+(?:number|no\.?)\s*[:#-]\s*([A-Z0-9][A-Z0-9._/-]*)/im,

    /(?:^|\n)\s*req(?:uisition)?\s+id\s*[:#-]\s*([A-Z0-9][A-Z0-9._/-]*)/im
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      String(description)
        .match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

async function searchTheirStack({
  apiKey,
  originalUrl,
  companyHint,
  positionHint,
  mode = "company"
}) {
  const country =
    countryFromIndeedHost(
      originalUrl
    );

  const body = {
    posted_at_max_age_days:
      365,

    limit:
      5,

    page:
      0
  };

  if (country) {
    body.job_country_code_or = [
      country
    ];
  }

  if (
    clean(positionHint)
  ) {
    body.job_title_or = [
      clean(positionHint)
    ];
  }

  /*
   * Search attempt 1:
   * company field + title.
   */
  if (
    mode === "company" &&
    clean(companyHint)
  ) {
    body.company_name_partial_match_or =
      [
        clean(
          companyHint
        )
      ];
  }

  /*
   * Search attempt 2:
   * company name in description
   * + title.
   */
  if (
    mode === "description" &&
    clean(companyHint)
  ) {
    body.job_description_contains_or =
      [
        clean(
          companyHint
        )
      ];
  }

  console.log(
    `[TheirStack import] ${mode} search:`,
    body
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      20000
    );

  try {
    const response =
      await fetch(
        THEIRSTACK_URL,
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`
          },

          body:
            JSON.stringify(
              body
            ),

          signal:
            controller.signal,

          cache:
            "no-store"
        }
      );

    return response;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function readTheirStackResponse(
  response
) {
  const raw =
    await response.text();

  let payload = {};

  try {
    payload =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      `TheirStack returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok) {
    const message =
      clean(
        payload?.error
          ?.description
      ) ||
      clean(
        payload?.error
          ?.title
      ) ||
      clean(
        payload?.message
      ) ||
      clean(
        payload?.detail
      ) ||
      `TheirStack returned ${response.status}.`;

    const error =
      new Error(message);

    error.status =
      response.status;

    throw error;
  }

  return {
    payload,

    jobs:
      Array.isArray(
        payload?.data
      )
        ? payload.data
        : []
  };
}

export async function POST(
  request
) {
  try {
    const apiKey =
      process.env
        .THEIRSTACK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Server is missing THEIRSTACK_API_KEY. Add it to .env.local and restart Next.js."
        },
        {
          status:
            500
        }
      );
    }

    const body =
      await request.json();

    const rawUrl =
      clean(body?.url);

    const companyHint =
      clean(
        body?.company
      );

    const positionHint =
      clean(
        body?.position
      );

    console.log(
      "[TheirStack import] received:",
      {
        url:
          rawUrl,

        company:
          companyHint,

        position:
          positionHint
      }
    );

    if (!rawUrl) {
      return NextResponse.json(
        {
          error:
            "An Indeed job URL is required."
        },
        {
          status:
            400
        }
      );
    }

    /*
     * TheirStack cannot directly
     * resolve an Indeed jk, so require
     * company + position as matching
     * hints.
     */
    if (
      !companyHint ||
      !positionHint
    ) {
      return NextResponse.json(
        {
          error:
            "Enter the company and position before importing so the Indeed posting can be matched confidently."
        },
        {
          status:
            400
        }
      );
    }

    let normalizedIndeed;

    try {
      normalizedIndeed =
        normalizeIndeedUrl(
          rawUrl
        );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error.message
        },
        {
          status:
            400
        }
      );
    }

    /*
     * SEARCH 1:
     * Company field + title + country
     */
    let response =
      await searchTheirStack({
        apiKey,

        originalUrl:
          rawUrl,

        companyHint,

        positionHint,

        mode:
          "company"
      });

    let result =
      await readTheirStackResponse(
        response
      );

    let jobs =
      result.jobs;

    console.log(
      "[TheirStack import] company search found:",
      jobs.length
    );

    /*
     * SEARCH 2:
     *
     * If TheirStack has the employer
     * indexed under a different company
     * name, search for the supplied
     * company inside the description.
     */
    if (
      jobs.length === 0
    ) {
      console.log(
        "[TheirStack import] company search had no results; trying description search"
      );

      response =
        await searchTheirStack({
          apiKey,

          originalUrl:
            rawUrl,

          companyHint,

          positionHint,

          mode:
            "description"
        });

      result =
        await readTheirStackResponse(
          response
        );

      jobs =
        result.jobs;

      console.log(
        "[TheirStack import] description search found:",
        jobs.length
      );
    }

    console.log(
      "[TheirStack import] returned jobs:",
      jobs.map(
        job => ({
          title:
            getTitle(job),

          company:
            getCompany(job),

          location:
            getLocation(job),

          source_url:
            job?.source_url,

          url:
            job?.url
        })
      )
    );

    /*
     * No indexed job at all.
     */
    if (!jobs.length) {
      return NextResponse.json(
        {
          error:
            "TheirStack does not appear to have this posting indexed. No fields were changed."
        },
        {
          status:
            404
        }
      );
    }

    /*
     * Now verify that one of the
     * returned jobs is actually the
     * posting the user requested.
     */
    const match =
      findBestMatch(
        jobs,
        {
          jobKey:
            normalizedIndeed
              .jobKey,

          companyHint,

          positionHint
        }
      );

    if (!match) {
      return NextResponse.json(
        {
          error:
            "TheirStack found similar jobs, but none matched this posting confidently enough. No fields were changed."
        },
        {
          status:
            409
        }
      );
    }

    const job =
      match.job;

    const description =
      clean(
        job?.description
      );

    /*
     * Only populate fields we have
     * explicit information for.
     */
    const resultPayload = {
      source:
        "theirstack",

      matchType:
        match.matchType,

      /*
       * Keep the user's Indeed URL,
       * not TheirStack's URL.
       */
      sourceUrl:
        normalizedIndeed.url,

      company:
        getCompany(job),

      position:
        getTitle(job),

      location:
        getLocation(job),

      /*
       * Leave your custom job type
       * blank instead of guessing.
       */
      jobType:
        "",

      /*
       * Never use the Indeed jk as
       * requisition ID.
       */
      requisitionId:
        extractRequisitionId(
          description
        ),

      jobDescription:
        description,

      /*
       * Available for future use,
       * but not mapped into jobType.
       */
      employmentType:
        Array.isArray(
          job?.employment_statuses
        )
          ? job
              .employment_statuses
              .filter(Boolean)
              .join(", ")
          : ""
    };

    console.log(
      "[TheirStack import] matched:",
      {
        matchType:
          resultPayload
            .matchType,

        company:
          resultPayload
            .company,

        position:
          resultPayload
            .position,

        location:
          resultPayload
            .location,

        requisitionId:
          resultPayload
            .requisitionId
      }
    );

    return NextResponse.json(
      resultPayload
    );
  } catch (error) {
    console.error(
      "TheirStack import failed:",
      error
    );

    /*
     * Our 20-second provider timeout.
     */
    if (
      error?.name ===
      "AbortError"
    ) {
      return NextResponse.json(
        {
          error:
            "TheirStack took too long to respond. No fields were changed."
        },
        {
          status:
            504
        }
      );
    }

    /*
     * Preserve useful 4xx errors
     * returned by TheirStack.
     */
    const providerStatus =
      Number(
        error?.status
      );

    if (
      providerStatus >= 400 &&
      providerStatus < 500
    ) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "TheirStack rejected the request."
        },
        {
          status:
            providerStatus
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to import this Indeed posting."
      },
      {
        status:
          500
      }
    );
  }
}