import { Accordion, AccordionItem, Card, Link } from "../../src/index.js";

/** Consumer-supplied records; not a package API or execution engine. */
export interface DemoOperation {
  id: string;
  summary: string;
  state: "waiting" | "running" | "success" | "error";
  details: string;
}
export interface DemoSource {
  id: string;
  title: string;
  href: string;
  snippet: string;
}
const operationLabels = {
  waiting: "Waiting",
  running: "Running",
  success: "Complete",
  error: "Error",
};

export function ToolsSourcesPresentation(record: {
  operations: DemoOperation[];
  sources: DemoSource[];
}) {
  if (!record.operations.length && !record.sources.length) return null;
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      {!!record.operations.length && (
        <Accordion multiple aria-label="Operations">
          {record.operations.map((operation) => (
            <AccordionItem
              key={operation.id}
              id={operation.id}
              title={`${operation.summary} · ${operationLabels[operation.state]}`}
            >
              <p className={operation.state === "error" ? "text-danger-strong" : undefined}>
                {operation.details}
              </p>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {!!record.sources.length && (
        <section aria-label="Sources" className="flex min-w-0 flex-col gap-2">
          <h3 className="font-medium">Sources</h3>
          {record.sources.map((source) => (
            <Card key={source.id} size="sm">
              <Link href={source.href}>{source.title}</Link>
              <Accordion>
                <AccordionItem id={source.id} title={`${source.title} excerpt`}>
                  <p>{source.snippet}</p>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
