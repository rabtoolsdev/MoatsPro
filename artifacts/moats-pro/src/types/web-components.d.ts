declare namespace JSX {
  interface IntrinsicElements {
    "w3m-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        size?: "sm" | "md";
        label?: string;
        balance?: "show" | "hide";
        loadingLabel?: string;
      },
      HTMLElement
    >;
    "w3m-account-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        balance?: "show" | "hide";
      },
      HTMLElement
    >;
    "w3m-connect-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        size?: "sm" | "md";
        label?: string;
      },
      HTMLElement
    >;
    "w3m-network-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
  }
}
