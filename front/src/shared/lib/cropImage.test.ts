import { outputSide } from "./cropImage";

it("un recorte grande se reduce a 512 de lado", () => {
  expect(outputSide({ x: 0, y: 0, width: 3000, height: 3000 })).toBe(512);
});

it("un recorte más pequeño que 512 no se agranda", () => {
  expect(outputSide({ x: 10, y: 20, width: 300, height: 300 })).toBe(300);
});
