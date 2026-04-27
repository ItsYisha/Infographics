// Single source of truth for all prompts — prevents style drift across drill levels.

const STYLE = `Clean educationial infographic illustration, light background (#f5f5fa), 
modern sans-serif typography, bold dark headings with warm orange accent 
color highlights, soft card-style layout with subtle rounded corners, 
flat design with minimal depth shadows, academic yet approachable tone, 
white space-forward composition, no dark backgrounds, no vintage textures, 
no hand-drawn elements — crisp and digital-native aesthetic`;

/**
 * Prompt for generating the first page from a user query.
 */
function firstPagePrompt(query) {
  return `${STYLE} Topic: "${query}". \
'Imagine you're an experienced teacher.\
Generate a diagram that is informationally balanced, factually and logically clear, and engaging enough to spark user curiosity.\
For history-related topics, ground the explanation in geography wherever possible — show maps, trade routes, territorial boundaries, migration paths, or terrain that shaped events.`;
}

/**
 * Prompt for child page generation using the red-dot technique.
 * The model receives the annotated parent image — no coordinate numbers in the text.
 */
function childPagePrompt() {
  return `${STYLE} \
The red circle marks exactly where the reader pointed on the illustration. \
Generate the next explainer page by drilling into whatever element the red circle is on — \
zoom in to reveal its internal structure, mechanism, or sub-components. \
Do NOT include the red circle, cursor mark, or any annotation marker in the output. \
Match the painting style of the provided reference image exactly: \
same line weight, paper tone, palette, and title typography.`;
}

/**
 * Fun-facts prompt (vision) — used while a child image is generating.
 * Model receives the red-dot annotated parent image.
 *
 * Output format (streamed as plain text):
 *   FACT: [one fascinating sentence]
 *   FACT: [one fascinating sentence]
 *   … (exactly 20 lines)
 */
function funFactsPrompt() {
  return `This educational illustration has a red circle marking a specific element.

Identify exactly what is under the red circle, then generate 20 fascinating, surprising fun facts about it. Each fact must be a single vivid sentence (max 25 words), specific and delightful — the kind of thing that makes someone say "whoa, I didn't know that."

Output ONLY this format, no intro, no numbering, no extra text:
FACT: [fact]
FACT: [fact]
(exactly 20 FACT: lines)`;
}

/**
 * Topic fun-facts prompt (text-only) — used while the very first illustration generates.
 */
function topicFunFactsPrompt(query) {
  return `Generate 20 fascinating, surprising fun facts about: "${query}".

Each fact must be a single vivid sentence (max 25 words) — the kind of thing that makes someone say "whoa, I didn't know that." Be specific, varied, and cover different angles (history, science, extremes, surprising connections).

Output ONLY this format, no intro, no numbering, no extra text:
FACT: [fact]
FACT: [fact]
(exactly 20 FACT: lines)`;
}

module.exports = {
  firstPagePrompt,
  childPagePrompt,
  funFactsPrompt,
  topicFunFactsPrompt,
};
