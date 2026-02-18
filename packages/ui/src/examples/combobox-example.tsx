import { Combobox } from "../components/combobox";
import { InboxIcon, PinIcon, PlusIcon } from "../icons";

export const ComboboxExample = () => {
  const groups = [
    {
      heading: "Quick Access",
      items: [
        {
          value: "inbox",
          label: "Inbox",
          icon: <InboxIcon className="!size-4" />,
          keywords: ["inbox", "messages"],
          onSelect: () => console.log("Inbox selected"),
        },
        {
          value: "pinned",
          label: "Pinned",
          icon: <PinIcon className="!size-4" />,
          keywords: ["pinned", "favorites"],
          onSelect: () => console.log("Pinned selected"),
        },
      ],
    },
    {
      heading: "Actions",
      items: [
        {
          value: "create",
          label: "Create New",
          icon: <PlusIcon className="!size-4" />,
          keywords: ["create", "new", "add"],
          onSelect: () => console.log("Create selected"),
        },
      ],
    },
  ];

  return (
    <div className="flex gap-4 p-8">
      <Combobox
        trigger={{
          icon: <InboxIcon className="!size-4" />,
          label: "Select Option",
        }}
        groups={groups}
        placeholder="Search options..."
        emptyMessage="No options found."
        align="start"
        width="w-64"
      />

      <Combobox
        trigger={{
          icon: <PinIcon className="!size-4" />,
          label: "With Badge",
          badge: (
            <div className="size-4 bg-rose-500 rounded-md flex items-center justify-center">
              <span className="text-xs text-foreground font-medium">3</span>
            </div>
          ),
        }}
        groups={groups}
        placeholder="Search..."
        align="center"
        width="w-80"
      />
    </div>
  );
};
