export function tokensToCssVariables(tokens) {
  const { colors, typography, spacing, radii, shadows } = tokens;

  const lines = [":root {"];

  // Colors
  for (const [key, value] of Object.entries(colors)) {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    lines.push(`  --color-${cssKey}: ${value};`);
  }

  // Typography
  lines.push(`  --font-heading: ${typography.headingFont};`);
  lines.push(`  --font-body: ${typography.bodyFont};`);
  lines.push(`  --font-size-base: ${typography.baseSize};`);
  for (const [key, val] of Object.entries(typography.scale)) {
    lines.push(`  --font-size-${key}: ${val};`);
  }
  lines.push(`  --line-height-heading: ${typography.lineHeights.heading};`);
  lines.push(`  --line-height-body: ${typography.lineHeights.body};`);

  // Spacing
  lines.push(`  --spacing-unit: ${spacing.unit}px;`);
  spacing.scale.forEach((step, i) => {
    lines.push(`  --spacing-${i}: ${step * spacing.unit}px;`);
  });

  // Radii
  for (const [key, val] of Object.entries(radii)) {
    lines.push(`  --radius-${key}: ${val};`);
  }

  // Shadows
  for (const [key, val] of Object.entries(shadows)) {
    lines.push(`  --shadow-${key}: ${val};`);
  }

  lines.push("}");
  return lines.join("\n");
}