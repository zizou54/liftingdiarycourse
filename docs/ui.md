# UI Coding Standards

These standards apply to **all** UI code in this project. They are not optional.

## Components: shadcn/ui ONLY

**ONLY shadcn/ui components may be used to build the UI in this project.**

**ABSOLUTELY NO custom components may be created.** Every piece of UI must be composed from shadcn/ui components.

### Rules

- Use shadcn/ui components for every UI element: buttons, inputs, forms, cards, dialogs, tables, menus, popovers, calendars, badges, tabs, and so on.
- Do **not** create custom components: no hand-rolled buttons, cards, modals, wrappers, or "reusable" UI pieces of our own.
- Do **not** build UI from raw HTML elements styled with Tailwind when a shadcn/ui component exists for the job.
- Do **not** bring in other UI component libraries (MUI, Chakra, Mantine, Headless UI, etc.).
- If a needed component isn't in the project yet, add it with the shadcn CLI. Don't write it yourself:

  ```bash
  npx shadcn@latest add <component>
  ```

- shadcn/ui components live in `src/components/ui/` (alias `@/components/ui`) and are imported from there:

  ```tsx
  import { Button } from "@/components/ui/button";
  import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
  ```

- Use the component's built-in props and variants (e.g. `variant`, `size`) for styling. Tailwind classes via `className` are only for layout and spacing around components (e.g. `flex`, `gap-4`, `mt-6`).

## Date Formatting: date-fns

All date formatting must use [date-fns](https://date-fns.org/). Do not use `toLocaleDateString`, `Intl.DateTimeFormat`, or hand-built date strings.

### Required format

Dates must be shown as an ordinal day, a short month name, and a full year:

```
1st Sep 2025
2nd Aug 2025
3rd Jan 2026
4th Jun 2024
```

Use the date-fns format string `do MMM yyyy`:

```ts
import { format } from "date-fns";

format(new Date(2025, 8, 1), "do MMM yyyy"); // "1st Sep 2025"
format(new Date(2025, 7, 2), "do MMM yyyy"); // "2nd Aug 2025"
format(new Date(2026, 0, 3), "do MMM yyyy"); // "3rd Jan 2026"
format(new Date(2024, 5, 4), "do MMM yyyy"); // "4th Jun 2024"
```

| Token  | Meaning                    | Example |
| ------ | -------------------------- | ------- |
| `do`   | Day of month with ordinal  | `1st`   |
| `MMM`  | Short month name           | `Sep`   |
| `yyyy` | Full year                  | `2025`  |

Use this same format for every user-facing date in the app.
