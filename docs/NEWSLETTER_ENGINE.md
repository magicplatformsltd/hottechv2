# Newsletter Engine – Technical Overview

This document describes how the newsletter system works: tech stack, article picker and insertion (admin and email), and front-end rendering (including styling approach).

---

## 1. Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js (App Router) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (admin-only for newsletter management) |
| **Email delivery** | Resend (transactional/broadcast API) |
| **Email templating** | React Email – `@react-email/components` (e.g. `Html`, `Container`, `Section`, `Text`, `Link`, `Img`) |
| **Newsletter content editor** | TipTap (React) – rich text with custom nodes (PostCard, SocialCard, SponsorBlock, etc.) |
| **Admin UI** | React (client components), Tailwind CSS |
| **Public site** | Next.js server components, Tailwind CSS |

**Data flow (high level):**

- **Create/Edit:** Admin uses a form (subject, slug, preview text, featured image, **HTML content**). Content is produced by the TipTap-based `RichTextEditor` and stored as **raw HTML** in `newsletters.content`.
- **Send:** Server action loads newsletter + audience, then calls `sendBroadcast()` which uses Resend to send one email per subscriber. Each email is rendered with the `WeeklyNewsletter` React Email template, which receives the same HTML string and injects it into the email body.
- **Public archive / web view:** Next.js pages fetch newsletter(s) from Supabase and render the same HTML in the browser (archive list + single-issue view).

---

## 2. Article Picker and Insertion (Newsletter / Admin)

### 2.1 Where it lives

- **Article picker UI:** `components/admin/media/PostPickerModal.tsx`
- **Picker data:** `lib/actions/post-picker.ts` (server action `searchPosts`)
- **Editor integration:** `components/admin/editor/RichTextEditor.tsx` (toolbar button + `handlePostSelect`)
- **Custom node (card in content):** `components/admin/editor/extensions/PostCard.ts` (TipTap node)

The same `RichTextEditor` is used for **both** post body (e.g. `edit-post-form`) and **newsletter content** (e.g. `NewsletterForm.tsx`, `edit-newsletter-form.tsx`). So the article picker and PostCard insertion behave the same in posts and newsletters.

### 2.2 Post picker logic

1. **Opening the picker**  
   In `RichTextEditor`, a toolbar button (“Embed post card”, FileText icon) sets `postPickerOpen` to true and renders `PostPickerModal`.

2. **Fetching posts**  
   `PostPickerModal` calls the server action `searchPosts(query?)` from `lib/actions/post-picker.ts`:
   - **Auth:** Uses Supabase server client; only runs for authenticated users (admin).
   - **Query:** Selects from `posts`: `id`, `title`, `slug`, `excerpt`, `main_image`, `published_at`, with `status = 'published'`, ordered by `published_at` desc, limit 50.
   - **Search:** If `query` is provided, filters with `ilike("title", `%${query}%`)`.
   - **Return type:** `PostPickerPost[]` (`id`, `title`, `slug`, `excerpt`, `image`, `published_at`).

3. **UI behavior**  
   - On open, the modal fetches posts with no query.
   - A text input drives a debounced (200 ms) search; each change re-calls `searchPosts(search)`.
   - List shows thumbnail (or “No image”), title, date, and a “Select” button per post.

4. **On select**  
   When the user clicks “Select”, the modal calls `onSelect(post)` and closes.  
   In `RichTextEditor`, `handlePostSelect(post)`:
   - Normalizes image URL (or uses a placeholder).
   - Truncates excerpt to 160 chars.
   - Builds link URL as **`/blog/${post.slug}`** (note: the public article route in this app may be `/${slug}`; if so, links in newsletters may need to be updated to match).
   - Calls TipTap command:  
     `editor.chain().focus().setPostCard({ title, excerpt, image, url, date: post.published_at }).run()`  
   So the **insertion** is a single TipTap command that inserts the custom “postCard” node at the current cursor.

### 2.3 PostCard node (HTML/CSS/tech)

- **Definition:** `components/admin/editor/extensions/PostCard.ts` (TipTap `Node`).
- **Name:** `postCard`; **group:** `block`; **atom:** true (single unit, no editable inner content).
- **Attributes (stored in the document):** `title`, `excerpt`, `image`, `url`, `date`. Parsed from HTML via `data-*` attributes on a wrapper `div`.
- **Parse:** Matches `div[data-type="post-card"]`.
- **Render (output HTML):**  
  TipTap’s `renderHTML` returns a structure that becomes:
  - A wrapper **`div`** with `data-type="post-card"` and `data-title`, `data-excerpt`, `data-image`, `data-url`, `data-date`.
  - Inside: an **`<a href="...">`** with **inline styles** (no Tailwind):
    - Container: flex, gap, border, border-radius, background, margin, box-shadow, etc.
    - Image: `flex: 0 0 160px`, `width: 160px`, `min-height: 120px`, `background-size: cover`, `background-position: center`; image URL is set via **`background-image: url('...')`** on a div (no `<img>` in the serialized output).
    - Content block: flex, padding, title (h3), excerpt (p), “Read More →” (span).
  - All styling is **inline or in the `style` attribute** (e.g. `containerStyle`, `imageStyle`, `titleStyle`, `excerptStyle`, `readMoreStyle`). This is so the same HTML can be used in the **email** and on the **web** without relying on Tailwind or external stylesheets in email clients.

So: **article picker** = PostPickerModal + `searchPosts`; **insertion** = one TipTap command that inserts a PostCard node; **storage** = that node is serialized as the `div[data-type="post-card"]` HTML snippet above and becomes part of the newsletter’s **raw HTML** string in `newsletters.content`.

---

## 3. Newsletter Content in the Email

- **Template:** `emails/WeeklyNewsletter.tsx`.
- **Stack:** React Email (`@react-email/components`): `Html`, `Head`, `Preview`, `Section`, `Container`, `Text`, `Link`, `Hr`, `Img`.
- **Props:** `subject`, `previewText`, **`content`** (raw HTML string from TipTap), `slug`, `email`, `unsubscribeUrl`, `baseUrl`, `trackingPixelUrl`.
- **Body rendering:**  
  The template does **not** parse or special-case PostCard. It injects the whole newsletter HTML into one block:
  ```tsx
  <div
    className="newsletter-body"
    style={{ color, fontSize, lineHeight }}
    dangerouslySetInnerHTML={{ __html: content || "" }}
  />
  ```
- **CSS:** A `<style>` in `<Head>` targets `.newsletter-body` for `p`, `h1`, `h2`, `img` (margins, colors, font-size, max-width). PostCard markup is **already full of inline styles** from TipTap’s `renderHTML`, so it renders in email clients without extra classes. The email does **not** use Tailwind; it uses inline styles and this small scoped CSS block.

Sending pipeline (for context): `app/(admin)/admin/newsletters/actions.ts` (e.g. broadcast) → `lib/actions/sending.ts` → `sendBroadcast()` → Resend `emails.send()` with `react: WeeklyNewsletter({ ... content ... })`. So the **same** HTML string (including PostCard `div`s) is what recipients see in the email.

---

## 4. Front-End (Public Site) – Newsletter Pages

### 4.1 Routes and data

- **Archive (list):** `app/(website)/newsletters/page.tsx`  
  - Server component; fetches list via `getSentNewsletters()` from `lib/data.ts` (Supabase: `newsletters` where `status = 'sent'`, order by `sent_at` desc).  
  - Renders a grid of cards (link to `/newsletters/[slug]`, featured image, subject, preview text, date).

- **Single issue (web view):** `app/(website)/newsletters/[slug]/page.tsx`  
  - Server component; fetches one newsletter by `getNewsletterBySlug(slug)` (Supabase: `newsletters` by `slug`).  
  - Access control: if status is not `sent`, only admins (or appropriate auth) can view.  
  - Renders: header (subject, date), optional featured image, then the **same** `newsletter.content` HTML as the email body.

### 4.2 How the content (and PostCard) is rendered

- **Single-issue page** uses:
  ```tsx
  <div
    className="email-content prose prose-invert max-w-none"
    dangerouslySetInnerHTML={{ __html: newsletter.content ?? "" }}
  />
  ```
- So the **exact same** HTML produced by TipTap (including `div[data-type="post-card"]` with inline styles) is rendered on the page. No separate “article picker” or “insertion” step on the front end; it’s just **HTML injection**.
- **Tailwind:** Yes. The page uses Tailwind utility classes throughout, e.g.:
  - Layout: `mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8`
  - Typography: `font-serif text-4xl font-bold text-hot-white`, `font-sans text-sm text-gray-400`
  - Section: `mt-16 rounded-lg border border-white/10 bg-white/5 p-6`
  - Prose: `prose prose-invert max-w-none` (Tailwind Typography) on the content wrapper
- **Global CSS:** `app/globals.css` uses `@import "tailwindcss"` and defines `.prose` overrides (e.g. `.prose p` margin). So the **page** is Tailwind-based; the **injected HTML** (PostCard, etc.) still relies on the **inline styles** emitted by TipTap, so it looks correct even inside the Tailwind-styled layout.

### 4.3 Summary: front-end styling

- **Archive and single-issue pages:** Styled with **Tailwind CSS** (utility classes + `prose` for the content container).
- **Injected newsletter body (including embedded post cards):** Styled by **inline HTML/CSS** from the TipTap PostCard extension, not by Tailwind. So the front end is a mix: Tailwind for layout and chrome, inline for the stored newsletter HTML.

---

## 5. End-to-End Summary

| Step | What happens |
|------|----------------|
| **Admin: open article picker** | Toolbar in `RichTextEditor` opens `PostPickerModal`. |
| **Admin: search/select post** | Modal calls `searchPosts(query)` (Supabase, published posts); user selects one. |
| **Admin: insert** | `handlePostSelect` calls `editor.setPostCard({ title, excerpt, image, url, date })`. TipTap inserts a `postCard` node. |
| **Admin: save** | Newsletter form sends content as HTML (TipTap’s `getHTML()`). Stored in `newsletters.content` (Supabase). |
| **Email** | `WeeklyNewsletter` receives `content` and renders it with `dangerouslySetInnerHTML`. PostCard is already inline-styled HTML. |
| **Web view** | `newsletters/[slug]` page fetches newsletter, renders same HTML in a `prose`-wrapped div. PostCard appears as the same inline-styled block. |

**Tech recap:**

- **Article picker:** React modal + server action `searchPosts` (Supabase).  
- **Insertion:** TipTap custom node `PostCard`; output is inline-styled HTML (`div[data-type="post-card"]` + inner `<a>` + divs for image/content).  
- **Newsletter storage:** Raw HTML in `newsletters.content`.  
- **Email:** React Email template; body = that HTML; no Tailwind in email.  
- **Front end:** Next.js + **Tailwind** for the pages; newsletter body is raw HTML with inline styles (no Tailwind on the inserted PostCard markup).

---

## 6. Exact CSS and styling

Reference copy of the CSS and styling used in each part of the newsletter flow. Use this when matching design or debugging appearance in editor, email, or front end.

### 6.1 PostCard (embedded article block)

**Source:** `components/admin/editor/extensions/PostCard.ts`. Inline `style` strings applied to the serialized HTML (no Tailwind; same output in email and web).

| Variable | Exact value |
|----------|-------------|
| **containerStyle** (outer `<a>`) | `display:flex; gap:16px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; text-decoration:none; color:inherit; background:#ffffff; margin:24px 0; align-items:stretch; max-width:100%; box-shadow:0 1px 3px rgba(0,0,0,0.1);` |
| **imageStyle** (image div) | `flex:0 0 160px; width:160px; min-height:120px; background-size:cover; background-position:center;` (plus `background-image:url('...')` at render time) |
| **contentStyle** (text wrapper) | `flex:1; padding:16px; display:flex; flex-direction:column; justify-content:center; min-width:0;` |
| **titleStyle** (`h3`) | `margin:0 0 8px 0; font-size:18px; font-weight:600; line-height:1.3; color:#111;` |
| **excerptStyle** (`p`) | `margin:0; font-size:14px; color:#666; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;` |
| **readMoreStyle** (span) | `margin-top:12px; font-size:13px; font-weight:500; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px;` |

**Placeholder image** when no image URL: `https://placehold.co/600x200/1a1a1a/666?text=No+image`

**Note:** PostCard link URL is currently `/blog/${post.slug}` in `RichTextEditor`; the public article route may be `/${slug}`. Updating the editor to use `/${post.slug}` (or your real article base path) will fix links in newsletters.

---

### 6.2 Email template (WeeklyNewsletter)

**Source:** `emails/WeeklyNewsletter.tsx`.

**Theme object (inline styles):**
```ts
const styles = {
  dark: {
    backgroundColor: "#000000",
    color: "#ffffff",
    muted: "#9ca3af",
    border: "1px solid rgba(255,255,255,0.1)",
  },
};
```

**`<Head>` CSS (applies to `.newsletter-body` only):**
```css
.newsletter-body p { margin: 0 0 1em 0; color: #9ca3af; font-size: 16px; line-height: 1.6; }
.newsletter-body h1, .newsletter-body h2 { color: #ffffff; font-size: 20px; margin: 1em 0 0.5em 0; }
.newsletter-body img { max-width: 100%; height: auto; display: block; }
```

**Body wrapper inline style:** `color: #9ca3af`, `fontSize: "16px"`, `lineHeight: "1.6"`.

**Layout:** `Container` `maxWidth: "600px"`, `margin: "0 auto"`; sections use `padding: "24px 24px"` / `"40px 24px"` / `"32px 24px 24px"` as in the template. Footer `Hr` uses `borderColor: "rgba(255,255,255,0.1)"`. No Tailwind in the email.

---

### 6.3 Front-end newsletter single-issue page

**Source:** `app/(website)/newsletters/[slug]/page.tsx`. All Tailwind utility classes.

**Article wrapper:**
- `className`: `mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8` (plus `pb-16` when draft preview).

**Header:**
- Outer: `mb-10`
- Title: `font-serif text-4xl font-bold text-hot-white md:text-5xl`
- Date: `mt-3 font-sans text-sm text-gray-400`

**Featured image wrapper:** `relative mb-8 h-[280px] w-full overflow-hidden rounded-xl sm:h-[360px] md:h-[500px]`; `Image` has `className="object-cover"`, `sizes="(max-width: 896px) 100vw, 896px"`.

**Content (injected HTML):**
- Wrapper: `className="email-content prose prose-invert max-w-none"`

**“Stay in the loop” section:** `mt-16 rounded-lg border border-white/10 bg-white/5 p-6`; heading `font-serif text-lg font-semibold text-hot-white`; body `mt-2 font-sans text-sm text-gray-400`; CTA block `mt-4`.

**Draft banner:** `fixed bottom-0 left-0 right-0 z-50 bg-yellow-400 p-2 text-center font-sans font-bold text-black`.

---

### 6.4 PostPickerModal (admin article picker)

**Source:** `components/admin/media/PostPickerModal.tsx`. Tailwind only.

**Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`

**Panel:** `flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-white/10 bg-hot-black shadow-xl`

**Header:** `flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4`; title `font-serif text-xl font-semibold text-hot-white`; close button `rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-hot-white`

**Search input:** `w-full rounded-md border border-white/20 bg-black px-4 py-2 font-sans text-sm text-hot-white placeholder-gray-500 focus:border-white/40 focus:outline-none`

**List container:** `min-h-0 flex-1 overflow-y-auto p-4`; list `space-y-2`

**Row (each post):** `flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-3`; thumb wrapper `h-14 w-20 shrink-0 overflow-hidden rounded bg-white/10`; thumb img `h-full w-full object-cover`; title `font-sans font-medium text-hot-white truncate`; date `font-sans text-xs text-gray-500`; Select button `shrink-0 rounded-md bg-hot-white px-3 py-1.5 font-sans text-sm font-medium text-hot-black hover:bg-hot-white/90`

---

### 6.5 Global prose overrides (front end)

**Source:** `app/globals.css`. These apply to the newsletter content wrapper when it uses `prose`:

```css
.prose p {
  margin-bottom: 1.25em;
}
.prose p:last-child {
  margin-bottom: 0;
}
.prose p:empty {
  height: 1.25em;
  min-height: 1.25em;
}
```

**Design tokens (from same file):** `--color-hot-black: #050505`, `--color-hot-white: #F5F5F5`, `--color-hot-gray: #1A1A1A`, `--color-hot-red: #FF2E00`, `--color-hot-blue: #38bdf8`; `--font-sans` and `--font-serif` from theme.
