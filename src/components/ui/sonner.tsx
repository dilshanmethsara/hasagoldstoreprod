import { Toaster as Sonner } from "sonner";
import { AlertCircle, Check, Info, TriangleAlert, X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="hasa-toaster"
      position="top-center"
      offset={{ top: 88 }}
      mobileOffset={{ top: 16 }}
      duration={4200}
      gap={12}
      visibleToasts={4}
      closeButton
      expand
      icons={{
        success: <Check size={16} strokeWidth={2.6} />,
        error: <AlertCircle size={16} strokeWidth={2.2} />,
        info: <Info size={16} strokeWidth={2.2} />,
        warning: <TriangleAlert size={16} strokeWidth={2.2} />,
        close: <X size={14} strokeWidth={2.2} />,
      }}
      toastOptions={{
        classNames: {
          toast: "hasa-toast",
          title: "hasa-toast-title",
          description: "hasa-toast-desc",
          icon: "hasa-toast-icon",
          closeButton: "hasa-toast-close",
          success: "is-success",
          error: "is-error",
          info: "is-info",
          warning: "is-warning",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
