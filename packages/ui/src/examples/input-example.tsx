import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useId } from "react";

export const InputExample = () => {
  const emailId = useId();
  const passwordId = useId();
  const searchId = useId();
  const numberId = useId();
  const urlId = useId();
  const telId = useId();
  const textareaId = useId();
  const defaultId = useId();
  const valueId = useId();
  const disabledId = useId();
  const readonlyId = useId();
  const smallId = useId();
  const defaultSizeId = useId();
  const largeId = useId();
  const textareaDisabledId = useId();
  const textareaReadonlyId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailFormId = useId();
  const bioId = useId();

  return (
    <div className="flex flex-col gap-8">
      {/* Basic Input Types */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Basic Input Types</h3>
        <div className="flex flex-col gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor={emailId}>Email</Label>
            <Input id={emailId} type="email" placeholder="Enter your email" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>Password</Label>
            <Input id={passwordId} type="password" placeholder="Enter your password" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={searchId}>Search</Label>
            <Input id={searchId} type="search" placeholder="Search..." />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={numberId}>Number</Label>
            <Input id={numberId} type="number" placeholder="Enter a number" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={urlId}>URL</Label>
            <Input id={urlId} type="url" placeholder="https://example.com" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={telId}>Phone</Label>
            <Input id={telId} type="tel" placeholder="+1 (555) 123-4567" />
          </div>
        </div>
      </div>

      {/* Input States */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Input States</h3>
        <div className="flex flex-col gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor={defaultId} className="text-sm font-medium">
              Default
            </Label>
            <Input id={defaultId} placeholder="Default input" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={valueId} className="text-sm font-medium">
              With Value
            </Label>
            <Input id={valueId} defaultValue="Pre-filled value" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={disabledId} className="text-sm font-medium">
              Disabled
            </Label>
            <Input id={disabledId} placeholder="Disabled input" disabled />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={readonlyId} className="text-sm font-medium">
              Read Only
            </Label>
            <Input id={readonlyId} defaultValue="Read only value" readOnly />
          </div>
        </div>
      </div>

      {/* Input Sizes */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Input Sizes</h3>
        <div className="flex flex-col gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor={smallId} className="text-sm font-medium">
              Small
            </Label>
            <Input id={smallId} placeholder="Small input" className="h-8 text-sm" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={defaultSizeId} className="text-sm font-medium">
              Default
            </Label>
            <Input id={defaultSizeId} placeholder="Default input" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={largeId} className="text-sm font-medium">
              Large
            </Label>
            <Input id={largeId} placeholder="Large input" className="h-10 text-base" />
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Textarea</h3>
        <div className="flex flex-col gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor={textareaId} className="text-sm font-medium">
              Message
            </Label>
            <Textarea id={textareaId} placeholder="Enter your message here..." rows={4} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={textareaDisabledId} className="text-sm font-medium">
              Disabled Textarea
            </Label>
            <Textarea id={textareaDisabledId} placeholder="Disabled textarea" disabled rows={3} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={textareaReadonlyId} className="text-sm font-medium">
              Read Only Textarea
            </Label>
            <Textarea
              id={textareaReadonlyId}
              defaultValue="This is a read-only textarea with some content."
              readOnly
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Form Layout Example */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-medium text-foreground">Form Layout</h3>
        <div className="flex flex-col gap-6 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={firstNameId} className="text-sm font-medium">
                First Name
              </Label>
              <Input id={firstNameId} placeholder="John" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={lastNameId} className="text-sm font-medium">
                Last Name
              </Label>
              <Input id={lastNameId} placeholder="Doe" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={emailFormId} className="text-sm font-medium">
              Email Address
            </Label>
            <Input id={emailFormId} type="email" placeholder="john.doe@example.com" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={bioId} className="text-sm font-medium">
              Bio
            </Label>
            <Textarea id={bioId} placeholder="Tell us about yourself..." rows={4} />
          </div>
        </div>
      </div>
    </div>
  );
};
