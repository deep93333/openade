import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const AvatarExample = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-row justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Avatar className="h-8 w-8">
          <AvatarImage
            src="https://pbs.twimg.com/profile_images/1826618178945867776/xNdhg6Hk_400x400.jpg"
            alt="Small Avatar"
          />
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>

        <Avatar className="size-8">
          <AvatarImage
            src="https://pbs.twimg.com/profile_images/1826618178945867776/xNdhg6Hk_400x400.jpg"
            alt="Default Avatar"
          />
          <AvatarFallback>DF</AvatarFallback>
        </Avatar>

        <Avatar className="h-12 w-12">
          <AvatarImage
            src="https://pbs.twimg.com/profile_images/1826618178945867776/xNdhg6Hk_400x400.jpg"
            alt="Large Avatar"
          />
          <AvatarFallback>LG</AvatarFallback>
        </Avatar>

        <Avatar className="h-16 w-16">
          <AvatarImage
            src="https://pbs.twimg.com/profile_images/1826618178945867776/xNdhg6Hk_400x400.jpg"
            alt="Extra Large Avatar"
          />
          <AvatarFallback>XL</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-row justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Avatar className="size-8">
          <AvatarImage src="https://broken-link.com/image.png" alt="Broken Image" />
          <AvatarFallback>BI</AvatarFallback>
        </Avatar>

        <Avatar className="size-8">
          <AvatarFallback>NF</AvatarFallback>
        </Avatar>

        <Avatar className="size-8">
          <AvatarFallback className="bg-blue-200">AB</AvatarFallback>
        </Avatar>

        <Avatar className="size-8">
          <AvatarFallback className="bg-yellow-200">CD</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
};
