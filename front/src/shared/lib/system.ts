import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Mismo verde-azulado que Johan dibujo como color de marca en el boceto
// "Boceto Mini ERP" (Artifact de diseño). Chakra exige la escala completa
// 50-950 y estos tokens semanticos para poder usar colorPalette="brand".
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#EAF4F5" },
          100: { value: "#CFE6E8" },
          200: { value: "#9AD3D8" },
          300: { value: "#5FB6BD" },
          400: { value: "#2E96A0" },
          500: { value: "#0E7C86" },
          600: { value: "#0A5C64" },
          700: { value: "#084A50" },
          800: { value: "#06383D" },
          900: { value: "#042529" },
          950: { value: "#021619" },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.brand.600}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.200}" },
          focusRing: { value: "{colors.brand.500}" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
