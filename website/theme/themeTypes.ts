export interface ZelrexTheme {
  name: string;

  /* Colors */
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;

  /* Typography */
  fontFamily: string;
  headingWeight: number;
  bodyWeight: number;

  /* Layout rhythm */
  maxWidth: number;
  pagePadding: number;
  sectionGap: number;

  /* Hero scale */
  heroTitleSize: number;
  heroSubtitleSize: number;

  /* Buttons */
  button: {
    background: string;
    text: string;
    radius: number;
    height: number;
  };

  /* Effects */
  shadow: string;
}
