# Brutal: Product Evolution Roadmap
How to transcend the "AI Wrapper" label and build a high-value technical advisor.

## 1. Move from "Chat" to "Workflows"
Wrappers rely on users to ask the right questions. A product provides opinionated solutions.
- **One-Click Code Roasts:** Paste code and get a structured, multi-step critique (security, performance, style).
- **Automated PR Reviews:** Ingest diffs directly and provide line-by-line feedback.
- **Side-by-Side Diffs:** Instead of code blocks, show "Before/After" views with one-click copy/apply.

## 2. Deep Context (RAG)
Knowing more than just the general training data by understanding the user's specific project.
- **Project-Level Context:** Allow uploads or repo linking so the AI knows the project architecture.
- **Consistency Enforcement:** Catch violations of project-specific patterns (e.g., "You used the wrong utility function for this repo").

## 3. Agentic Capabilities (Tools)
Give the AI the ability to *do* things, not just *talk* about them.
- **Live Web Search:** Fetch real-time documentation for new libraries to prevent hallucinations.
- **Code Execution:** Run generated snippets in a sandbox to verify they work before showing them to the user.

## 4. Specialized UI/UX
Differentiate the interface from standard chat apps like ChatGPT.
- **Code-First Layout:** Focus on a large editor/code view with the AI as an annotator.
- **Interactive Annotations:** Attach AI comments directly to specific lines of code.

## 5. IDE & System Integration
Minimize context switching for "ruthless efficiency."
- **Local File Sync:** Connect the web app to a local agent to read/write files in the user's workspace.
- **Terminal Integration:** Generate and explain shell commands that are ready to be executed.
