import { cn } from "@/lib/utils";
import { CircleEllipsisIcon, LucideIcon } from "lucide-react";
import { JSX } from "react";

type Props = {
  icon?: LucideIcon;
  title?: string;
  subtitle?: string;
  button?: JSX.Element;

  iconClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export default function Placeholder(props: Props) {
  return (
    <div
      className={cn(
        "p-2 flex flex-col justify-center items-center gap-2",
        "w-full h-full max-w-[500px] mx-auto"
      )}
    >
      <div className="rounded-full bg-accent w-20 h-20 flex justify-center items-center">
        {props.icon ? (
          <props.icon
            className={cn("stroke-primary", props.iconClassName)}
            size={40}
          />
        ) : (
          <CircleEllipsisIcon
            className={cn("stroke-primary", props.iconClassName)}
            size={40}
          />
        )}
      </div>
      <div className="flex flex-col gap-1 text-center items-center">
        <p className="font-bold">
          {props.title ? props.title : "Title unknown"}
        </p>
        <p className="text-sm text-muted-foreground">
          {props.subtitle !== undefined ? props.subtitle : "Subtitle unknown"}
        </p>
        {props.button}
      </div>
    </div>
  );
}
