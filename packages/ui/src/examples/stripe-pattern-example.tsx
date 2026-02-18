import { StripePattern } from "../components/stripe-pattern";

export const StripePatternExample = () => {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h3 className="text-sm font-medium mb-2">Default Variant</h3>
        <div className="w-full h-32 rounded-lg overflow-hidden">
          <StripePattern />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Dense Variant (Perfect for Placeholders)</h3>
        <div className="w-full h-32 rounded-lg overflow-hidden">
          <StripePattern variant="dense" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Shimmer Variant (Animated)</h3>
        <div className="w-full h-32 rounded-lg overflow-hidden">
          <StripePattern variant="shimmer" animate />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Custom Dimensions</h3>
        <div className="flex gap-4">
          <StripePattern variant="dense" width="200px" height="200px" className="rounded-lg" />
          <StripePattern variant="dense" width="150px" height="100px" className="rounded-lg" />
          <StripePattern variant="dense" width="100px" height="150px" className="rounded-lg" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Fills Any Container</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 rounded-lg overflow-hidden">
            <StripePattern variant="dense" />
          </div>
          <div className="h-40 rounded-lg overflow-hidden">
            <StripePattern variant="dense" />
          </div>
          <div className="h-32 rounded-lg overflow-hidden">
            <StripePattern variant="dense" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Custom Angle</h3>
        <div className="flex gap-4">
          <StripePattern
            variant="dense"
            angle={0}
            width="150px"
            height="150px"
            className="rounded-lg"
          />
          <StripePattern
            variant="dense"
            angle={45}
            width="150px"
            height="150px"
            className="rounded-lg"
          />
          <StripePattern
            variant="dense"
            angle={90}
            width="150px"
            height="150px"
            className="rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};
