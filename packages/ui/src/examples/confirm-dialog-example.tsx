import { Button } from "../components/button";
import { ConfirmButton } from "../components/confirm-dialog";

export function ConfirmDialogExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-medium">ConfirmButton Examples</h2>

      <div className="pt-4">
        <h3 className="text-md font-medium mb-2">ConfirmButton Wrapper Examples</h3>
        <div className="space-x-2">
          <ConfirmButton
            title="Save Changes"
            description="Are you sure you want to save these changes?"
            confirmText="Save"
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              console.log("Changes saved!");
            }}
          >
            <Button variant="default">Save Changes</Button>
          </ConfirmButton>

          <ConfirmButton
            title="Delete Item"
            description="This action cannot be undone. This will permanently delete the item."
            confirmText="Delete"
            variant="destructive"
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              console.log("Item deleted!");
            }}
          >
            <Button variant="destructive">Delete Item</Button>
          </ConfirmButton>

          <ConfirmButton
            title="Reset Settings"
            description="This will reset all your settings to default values."
            confirmText="Reset"
            cancelText="Keep Settings"
            onConfirm={() => console.log("Settings reset!")}
            onCancel={() => console.log("Reset cancelled")}
          >
            <Button variant="secondary">Reset Settings</Button>
          </ConfirmButton>

          <ConfirmButton
            title="Custom Button"
            description="You can use any button variant or custom button."
            confirmText="Proceed"
            onConfirm={() => console.log("Custom action!")}
          >
            <Button variant="ghost" size="sm">
              Custom Ghost Button
            </Button>
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
