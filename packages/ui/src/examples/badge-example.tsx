import { Badge } from "../components/badge";

export const BadgeExample = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Badge Default Variants</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="purple">Purple</Badge>
          <Badge variant="blue">Blue</Badge>
          <Badge variant="green">Green</Badge>
          <Badge variant="yellow">Yellow</Badge>
          <Badge variant="orange">Orange</Badge>
          <Badge variant="red">Red</Badge>
          <Badge variant="gray">Gray</Badge>
          <Badge variant="indigo">Indigo</Badge>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Badge Small Rounded Variants</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default" size="sm" rounded="full">
            Default
          </Badge>
          <Badge variant="secondary" size="sm" rounded="full">
            Secondary
          </Badge>
          <Badge variant="destructive" size="sm" rounded="full">
            Destructive
          </Badge>
          <Badge variant="outline" size="sm" rounded="full">
            Outline
          </Badge>
          <Badge variant="purple" size="sm" rounded="full">
            Purple
          </Badge>
          <Badge variant="blue" size="sm" rounded="full">
            Blue
          </Badge>
          <Badge variant="green" size="sm" rounded="full">
            Green
          </Badge>
          <Badge variant="yellow" size="sm" rounded="full">
            Yellow
          </Badge>
          <Badge variant="orange" size="sm" rounded="full">
            Orange
          </Badge>
          <Badge variant="red" size="sm" rounded="full">
            Red
          </Badge>
          <Badge variant="gray" size="sm" rounded="full">
            Gray
          </Badge>
          <Badge variant="indigo" size="sm" rounded="full">
            Indigo
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Features</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Multiple variants (default, secondary, destructive, outline)</li>
          <li>• Custom color classes for status and capability indicators</li>
          <li>• Support for icons and emojis</li>
          <li>• Dark mode compatible</li>
          <li>• Responsive and accessible</li>
        </ul>
      </div>
    </div>
  );
};
