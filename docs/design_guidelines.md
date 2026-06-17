# Summer ChatBot Design Guidelines

These guidelines describe the UX/UI style implemented in the Summer ChatBot application to ensure a polished, professional, and visually appealing experience.

## Typography
The application uses modern Google Fonts to separate headings from standard text:
- **Primary Text (Sans)**: `Montserrat` — Used for standard body text and reading elements.
- **Secondary Text (Sans)**: `Be Vietnam Pro` (`font-secondary`) — Used for subtitles, inputs, buttons, and descriptive components. 
- **Titles (Display)**: `Anton` (`font-title`) — Used exclusively for large headers and main titles. Always apply `uppercase tracking-wide` when using this font.

## Color Palette
Avoid generic colors. Use the following tailored pastel and vibrant colors to keep the "Summer" brand identity:
- **Summer Blue**: `#92ADEF` (`bg-summer-blue`, `text-summer-blue`) — Primary action color (buttons, main headers, important icons).
- **Summer Teal**: `#8DD4DA` (`bg-summer-teal`, `text-summer-teal`) — Secondary action color and success states (e.g., Modo Mentor, matched competencies).
- **Summer Pink**: `#F4C4DC` (`bg-summer-pink`, `text-summer-pink`) — Used for distinct elements like the Coach Session scenario selection avatar backgrounds.
- **Summer Yellow**: `#FDE49C` (`bg-summer-yellow`, `text-summer-yellow`) — Used for warnings or highlights.
- **Summer Peach**: `#ECC389` (`bg-summer-peach`, `text-summer-peach`) — Used for "Opportunities for Improvement" and the active session header.
- **Warm Background**: `#FFFBF5` (`bg-warm-bg`) — The primary application background to keep the interface warm and inviting.

## UI Elements & Shapes
- **Borders & Radii**: Favor fully rounded pills (`rounded-full`) or highly rounded boxes (`rounded-2xl`, `rounded-3xl`, `rounded-[1.5rem]`). Avoid sharp corners (`rounded` or `rounded-md`).
- **Shadows**: Keep shadows soft and subtle. Use `shadow-sm` for normal states and `shadow-md` for hovered elements to create depth.
- **Borders**: Use soft borders (`border-stone-100` or `border-stone-200`) or colored borders with high transparency (e.g., `border-summer-teal/30`).

## Interactive States (Hover & Transitions)
- Every interactive element (buttons, links, scenario cards) must have a transition (`transition-all` or `transition-colors`).
- Use subtle scaling on hover for important buttons and cards: `hover:scale-[1.02]`.
- For avatar cards, scale the avatar container slightly on hover: `group-hover:scale-105`.

## Images and Avatars
- Ensure avatars are visually prominent. 
- **Modo Coach**: Use \`/avatar-martina.png\` for character simulation.
- **Modo Mentor**: Use \`/avatar-mentor.jpg\` for the Summer ChatBot identity.
- **Dimensions**: Use \`w-20 h-20 sm:w-24 sm:h-24\` on scenario cards and \`w-14 h-14 sm:w-16 sm:h-16\` on chat headers.
- Avatars must use \`object-cover\` and \`overflow-hidden\` to perfectly fit their rounded containers.
