import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react").then(mod => mod.default as ComponentType<{ url: string }>), {
  ssr: false,
});

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}
