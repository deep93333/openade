import { ModelSelector } from "../chat/model-selector";

export const ModelSelectorExample = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Model Selector with Hover Details</h3>
        <p className="text-xs text-muted-foreground">
          Hover over any model in the dropdown to see detailed information including pricing,
          capabilities, and context. Only one detail card shows at a time for a smooth experience.
        </p>
        <div className="flex items-center gap-4">
          <ModelSelector />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Features</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Hover to see model details (pricing, capabilities, context)</li>
          <li>• Single detail card prevents multiple overlapping cards</li>
          <li>• Smooth transitions with debounced hover effects</li>
          <li>• Visual status indicators (Available, Locked, Beta)</li>
          <li>• Capability badges with icons (Vision, Tools, Code, etc.)</li>
          <li>• Provider-specific icons (OpenAI, Anthropic, Google)</li>
          <li>• Direct links to API docs and model pages</li>
          <li>• Responsive hover card positioning</li>
        </ul>
      </div>
    </div>
  );
};
