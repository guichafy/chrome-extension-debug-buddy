// Declaração para CodeMirror
declare const CodeMirror: any;

// Declaração para prettier
declare const prettier: {
  format: (content: string, options: {
    parser: string;
    printWidth: number;
    tabWidth: number;
    useTabs: boolean;
  }) => string;
};
