import { MantineProvider } from "@mantine/core";
import { Shell } from "./components/shell/Shell";

export const App = () => {
  return (
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <Shell />
    </MantineProvider>
  );
};
