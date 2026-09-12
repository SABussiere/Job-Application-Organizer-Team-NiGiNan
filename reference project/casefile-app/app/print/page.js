import { Suspense } from "react";
import PrintClient from "./PrintClient";

export const metadata = {
  title: "Resume — print"
};

export default function PrintPage() {
  return (
    <Suspense fallback={<p className="hint" style={{ padding: 24 }}>Loading resume...</p>}>
      <PrintClient />
    </Suspense>
  );
}
