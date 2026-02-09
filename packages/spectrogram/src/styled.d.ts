import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    timescaleBackgroundColor?: string;
    textColor?: string;
    waveProgressColor?: string;
  }
}
