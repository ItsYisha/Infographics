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
 * Prompt for the questions panel (gpt-4o-mini, vision).
 * Model receives the red-dot annotated image and generates questions
 * that build anticipation while the next image generates.
 *
 * Output format (streamed as plain text):
 *   Line 1: "Zooming into: <element name>"
 *   Lines 2-N: "• <question>?"
 */
function questionsPrompt() {
  return `This educational illustration has a red circle marking a specific element the reader wants to explore.

First, identify the exact element or concept under the red circle (be specific, e.g. "Turbine Blades" not just "turbine").

Then output EXACTLY in this format — no extra text, no markdown, no introduction:

Zooming into: [element name]

• [thought-provoking question about how it works]?
• [question connecting it to something the reader might know]?
• [question about why it matters or what would happen without it]?

Keep each question under 12 words. Be specific to this exact element. Total output: under 60 words.`;
}

/**
 * Text-only version for gpt-4o-mini (no vision).
 * Uses click position + parent topic context to generate relevant questions.
 * xPct/yPct: 0-1 normalised click coords.
 * topic: the root query (e.g. "why renaissance happened in Italy").
 * pageLabel: optional label of the current page (e.g. "Florence").
 */
function questionsPromptText(xPct, yPct, topic, pageLabel) {
  const hPos = xPct < 0.4 ? 'left side' : xPct > 0.6 ? 'right side' : 'center';
  const vPos = yPct < 0.4 ? 'upper area' : yPct > 0.6 ? 'lower area' : 'middle';

  const topicLine = topic
    ? `The infographic is about: "${pageLabel ? `${pageLabel} (part of: ${topic})` : topic}".`
    : 'The infographic is an educational diagram.';

  return `A user is studying an educational illustrated infographic and clicked on the ${hPos}, ${vPos} of the image to dive deeper.

${topicLine}

Identify the most likely specific element or concept shown in that region of THIS infographic (not a generic element — be specific to the topic), then generate 3 thought-provoking questions about it.

Output EXACTLY in this format, no extra text:

Zooming into: [specific element name relevant to the topic]

• [question about how it works or came to be]?
• [question connecting it to the bigger picture]?
• [question about why it matters or what would change without it]?

Keep each question under 12 words. Total output under 60 words.`;
}

/**
 * Topic-narration prompt — runs while the very first illustration is generating.
 * Gives the user something to read during the 30-60s wait so it doesn't feel boring.
 *
 * Output format (streamed as plain text — same shape as questionsPromptText):
 *   Line 1: "Exploring: <topic>"
 *   Lines 2-N: "• <question>?"
 */
function topicNarrationPrompt(query) {
  return `A user just typed this topic into a visual knowledge explorer: "${query}".

While the illustration is being drawn, give them three thought-provoking questions that build anticipation and prime their curiosity. Output EXACTLY in this format — no extra text, no markdown, no introduction:

Exploring: ${query}

• [question about a key mechanism, structure, or cause behind this topic]?
• [question that connects it to something familiar or surprising]?
• [question about why it matters or what would happen without it]?

Keep each question under 12 words. Be specific to this exact topic. Total output: under 60 words.`;
}

module.exports = {
  firstPagePrompt,
  childPagePrompt,
  questionsPrompt,
  questionsPromptText,
  topicNarrationPrompt,
};
