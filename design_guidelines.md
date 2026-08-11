{
  "product": {
    "name": "Rokadly",
    "design_personality": [
      "Premium Indian ledger reimagined for luxury jewellery retail",
      "Operationally strict: red=problem/pending/shortage, green=matched/verified",
      "Fast, dense, and trustworthy (cashier mobile speed + accountant desktop rigor)",
      "Tactile shell surfaces (woven/fabric) + clean reading surfaces (tables/forms)"
    ],
    "non_negotiables": [
      "First screen after login is role dashboard (no marketing hero)",
      "No purple gradients; no generic fintech look",
      "No loud texture behind dense tables or form fields",
      "Pending reconciliation rows must be FILLED RED (not a tiny icon)",
      "Cards radius <= 8px",
      "Mobile-first: sticky primary actions, numeric keyboards, no horizontal overflow",
      "Desktop: compact tables, split views, keyboard-friendly entry, sticky headers/totals",
      "Print/PDF layouts must be clean with repeated table headers"
    ]
  },

  "design_tokens": {
    "fonts": {
      "google_fonts_import": "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');",
      "font_family": {
        "display": "Space Grotesk, ui-sans-serif, system-ui",
        "body": "IBM Plex Sans, ui-sans-serif, system-ui",
        "mono": "IBM Plex Mono, ui-monospace, SFMono-Regular"
      },
      "usage": {
        "app_shell_titles": "display",
        "tables_forms_body": "body",
        "bill_numbers_serials_amounts_optional": "mono (sparingly for scan + alignment)"
      },
      "type_scale_tailwind": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
        "h2": "text-base md:text-lg font-medium text-muted-foreground",
        "section_title": "text-lg font-semibold tracking-tight",
        "table_header": "text-xs font-semibold uppercase tracking-wide",
        "body": "text-sm md:text-base",
        "small": "text-xs text-muted-foreground"
      }
    },

    "color_system": {
      "notes": [
        "Red/Green are semantic and must not be used decoratively outside status contexts.",
        "Brass is an accent for dividers, icons, and subtle highlights (never for error/success).",
        "Warm white + graphite keep luxury feel without fintech neon."
      ],
      "css_variables_hsl": {
        "--background": "36 33% 98%",
        "--foreground": "220 13% 12%",

        "--card": "36 33% 99%",
        "--card-foreground": "220 13% 12%",

        "--popover": "36 33% 99%",
        "--popover-foreground": "220 13% 12%",

        "--primary": "220 13% 12%",
        "--primary-foreground": "36 33% 98%",

        "--secondary": "36 18% 94%",
        "--secondary-foreground": "220 13% 12%",

        "--muted": "36 18% 94%",
        "--muted-foreground": "220 8% 42%",

        "--accent": "36 18% 94%",
        "--accent-foreground": "220 13% 12%",

        "--border": "36 12% 86%",
        "--input": "36 12% 86%",
        "--ring": "220 13% 12%",

        "--radius": "0.5rem",

        "--ruby": "350 72% 38%",
        "--ruby-foreground": "36 33% 98%",
        "--emerald": "154 55% 28%",
        "--emerald-foreground": "36 33% 98%",
        "--brass": "43 52% 46%",
        "--brass-foreground": "220 13% 12%",

        "--danger": "350 72% 38%",
        "--danger-foreground": "36 33% 98%",
        "--success": "154 55% 28%",
        "--success-foreground": "36 33% 98%",
        "--warning": "38 92% 45%",
        "--warning-foreground": "220 13% 12%",
        "--info": "205 70% 38%",
        "--info-foreground": "36 33% 98%"
      },
      "tailwind_usage_examples": {
        "pending_row": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]",
        "verified_badge": "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
        "brass_divider": "border-[hsl(var(--brass))]/30",
        "shell_graphite": "bg-[hsl(220_13%_12%)] text-[hsl(36_33%_98%)]"
      },
      "money_value_semantics": {
        "positive": {
          "color": "text-[hsl(var(--success))]",
          "weight": "font-semibold",
          "secondary_cue": "prefix '+' where appropriate or use badge label 'Excess'"
        },
        "negative": {
          "color": "text-[hsl(var(--danger))]",
          "weight": "font-semibold",
          "secondary_cue": "prefix '−' and label 'Short'/'Less Taken'"
        },
        "neutral": {
          "color": "text-foreground",
          "weight": "font-medium"
        },
        "unusually_large": {
          "treatment": "add subtle brass left border + tooltip explaining threshold",
          "classes": "border-l-2 border-[hsl(var(--brass))] pl-2"
        }
      }
    },

    "spacing_and_density": {
      "global": {
        "page_padding": "px-3 sm:px-4 lg:px-6",
        "section_gap": "space-y-4 sm:space-y-6",
        "card_radius": "rounded-lg (8px) only; avoid xl",
        "focus_ring": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--brass))] focus-visible:ring-offset-2"
      },
      "tables": {
        "default_density": "compact",
        "compact": {
          "row_height": "h-9",
          "cell_padding": "py-1.5 px-2",
          "font": "text-xs sm:text-sm",
          "header": "h-9 text-[11px]"
        },
        "comfortable": {
          "row_height": "h-11",
          "cell_padding": "py-2 px-3",
          "font": "text-sm",
          "header": "h-10 text-xs"
        },
        "alignment": {
          "numbers": "text-right tabular-nums",
          "ids": "font-mono text-[12px]",
          "status": "text-left"
        }
      },
      "forms": {
        "input_height": "h-11 (mobile), h-10 (desktop)",
        "tap_targets": "min-h-[44px]",
        "numeric_inputs": "inputMode='decimal' pattern='[0-9]*'"
      }
    },

    "shadows_and_surfaces": {
      "shell": {
        "shadow": "shadow-[0_1px_0_rgba(0,0,0,0.08)]",
        "border": "border border-white/10",
        "texture": "woven/noise overlay ONLY in shell areas"
      },
      "content": {
        "shadow": "shadow-sm",
        "border": "border border-border",
        "background": "bg-card"
      },
      "danger_fill": {
        "shadow": "shadow-[0_1px_0_rgba(0,0,0,0.12)]",
        "border": "border border-black/10"
      }
    }
  },

  "texture_spec": {
    "rule": "Texture ONLY in shell areas: login background, top nav, side nav, page headers. Never behind tables/forms.",
    "implementation": {
      "approach": "CSS woven pattern + subtle noise overlay",
      "css_snippet": ".shell-texture {\n  position: relative;\n  background: hsl(220 13% 12%);\n  color: hsl(36 33% 98%);\n}\n.shell-texture::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  opacity: 0.10;\n  background-image:\n    repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 1px, rgba(255,255,255,0) 1px 6px),\n    repeating-linear-gradient(-45deg, rgba(0,0,0,0.18) 0 1px, rgba(0,0,0,0) 1px 7px);\n  mix-blend-mode: overlay;\n}\n.shell-texture::after {\n  content: '';\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  opacity: 0.06;\n  background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"120\" height=\"120\" filter=\"url(%23n)\" opacity=\"0.35\"/></svg>');\n  mix-blend-mode: soft-light;\n}",
      "do_not": [
        "Do not apply texture class to Table, Card containing forms, or any reading-heavy area",
        "Do not exceed opacity 0.12 for weave and 0.08 for noise"
      ]
    }
  },

  "layout_blueprints": {
    "app_shell": {
      "mobile": {
        "pattern": "Top app bar + bottom sticky action bar (contextual) + content",
        "nav": "Use Sheet for navigation drawer; keep primary actions sticky",
        "safe_area": "pb-[calc(env(safe-area-inset-bottom)+72px)]"
      },
      "desktop": {
        "pattern": "Left sidebar (collapsible) + top header + content",
        "grid": "12-col; tables span 8-12 cols; side panels 4 cols",
        "split_views": "Use Resizable panels for reconciliation/detail"
      }
    },

    "dashboards": {
      "cashier": {
        "goal": "Start/continue bill drafts fast; see today's totals and conflicts",
        "layout": [
          "Top: Today summary strip (Cash/Card/Cheque/Bank/Other + variance)",
          "Middle: Draft switcher (Tabs) + Bill entry form",
          "Bottom: Today's bills list (compact table)"
        ],
        "key_components": ["Tabs", "Table", "Input", "Button", "Badge", "Alert"]
      },
      "accountant": {
        "goal": "Reconcile numbered non-cash entries against bank statements; print lists",
        "layout": [
          "Left: Filters + group selector (Card/Cheque/Banks/Other) + Pending-only toggle",
          "Center: Dense reconciliation table with serials and status",
          "Right: Detail Sheet/Panel for selected row + checklist/tally"
        ],
        "key_components": ["Resizable", "Table", "Sheet", "Checkbox", "Tooltip", "Badge"]
      },
      "manager": {
        "goal": "Review readiness checklist; resolve discrepancies; finalize",
        "layout": [
          "Top: Readiness checklist (progress + blockers)",
          "Middle: Exceptions queue (pending red rows) + quick actions",
          "Right: Finalize panel with green verified tick state"
        ]
      },
      "admin": {
        "goal": "Compare stores side-by-side; manage masters/users; audit",
        "layout": [
          "Comparison: two-column store compare with synchronized scroll",
          "Admin pages: table-first CRUD with dialogs"
        ]
      }
    }
  },

  "component_system": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui/",
      "use_components": [
        "button.jsx",
        "input.jsx",
        "select.jsx",
        "tabs.jsx",
        "table.jsx",
        "badge.jsx",
        "tooltip.jsx",
        "sheet.jsx",
        "dialog.jsx",
        "alert.jsx",
        "calendar.jsx",
        "checkbox.jsx",
        "switch.jsx",
        "separator.jsx",
        "scroll-area.jsx",
        "resizable.jsx",
        "sonner.jsx",
        "skeleton.jsx"
      ]
    },

    "buttons": {
      "style": "Professional/Luxury: medium radius (6–8px), confident fills, minimal shadow",
      "variants": {
        "primary": {
          "use": "Main commit actions (Save Draft, Submit, Finalize)",
          "classes": "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90",
          "motion": "transition-colors duration-150"
        },
        "danger": {
          "use": "Destructive actions (Delete draft, Reopen day)",
          "classes": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))] hover:bg-[hsl(var(--danger))]/90",
          "motion": "transition-colors duration-150"
        },
        "success": {
          "use": "Confirm/verify actions (Mark matched, Verify)",
          "classes": "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90",
          "motion": "transition-colors duration-150"
        },
        "secondary": {
          "use": "Non-primary actions",
          "classes": "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80",
          "motion": "transition-colors duration-150"
        },
        "ghost": {
          "use": "Toolbar icon buttons",
          "classes": "hover:bg-black/5",
          "motion": "transition-colors duration-150"
        }
      },
      "sizes": {
        "mobile_primary": "h-11 px-4 text-sm",
        "desktop": "h-10 px-3 text-sm",
        "icon": "h-10 w-10"
      }
    },

    "badges_and_states": {
      "pending": {
        "rule": "Pending must be filled red block/row",
        "row_classes": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]",
        "badge": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]"
      },
      "matched": {
        "row_classes": "bg-[hsl(var(--success))]/10 text-foreground",
        "badge": "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
      },
      "bounced": {
        "row_classes": "bg-[hsl(var(--danger))]/10 border-l-4 border-[hsl(var(--danger))]",
        "badge": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]"
      },
      "conflict": {
        "banner": "Use Alert with ruby fill + clear CTA to resolve; preserve draft"
      }
    },

    "tables": {
      "pattern": "Table-first, compact, sticky header, right-aligned amounts, serial column in mono",
      "sticky_header": "sticky top-0 z-10 bg-[hsl(var(--background))]",
      "row_hover": "hover:bg-black/3 (very subtle) transition-colors duration-150",
      "selected_row": "data-[state=selected]:bg-[hsl(var(--brass))]/12",
      "pending_row": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))] hover:bg-[hsl(var(--danger))]/95",
      "amount_cell": "text-right tabular-nums font-medium",
      "variance_badge": "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
    },

    "forms_mobile_fast_entry": {
      "draft_switcher": {
        "component": "Tabs",
        "behavior": "Scrollable tab list; show bill number + status dot; long-press to close",
        "classes": "sticky top-[var(--appbar-h)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      },
      "payment_breakup_rows": {
        "pattern": "Row per payment type with amount input + quick add",
        "quick_add": "Use ToggleGroup for payment types + Button '+' to append",
        "numeric": "Input with inputMode='decimal' and right-aligned tabular-nums"
      },
      "sticky_action_bar": {
        "pattern": "Bottom bar with primary action + secondary",
        "classes": "fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-3 py-2",
        "buttons": "Primary: Save/Submit; Secondary: Add payment / Clear"
      }
    },

    "navigation": {
      "desktop_sidebar": {
        "pattern": "Graphite shell with woven texture; brass active indicator",
        "active_item": "bg-white/8 text-white border-l-2 border-[hsl(var(--brass))]",
        "icon": "lucide-react icons + Tooltip"
      },
      "mobile_nav": {
        "pattern": "Sheet drawer; keep current store + date pinned at top"
      }
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Restrained: motion supports speed and clarity",
      "No universal transition: only transition-colors/opacity/shadow",
      "Use subtle press feedback for mobile (scale 0.98)"
    ],
    "recommended_library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "use_cases": [
        "Row detail panel entrance",
        "Draft tab add/remove",
        "Toast/alert subtle slide"
      ]
    },
    "interaction_specs": {
      "buttons": "hover: color shift; active: scale-[0.98]",
      "table_rows": "hover highlight only; selected row uses brass tint",
      "pending_rows": "no pulsing; keep solid red for seriousness",
      "loading": "Skeleton for tables; progress for checklist"
    }
  },

  "print_css": {
    "goals": [
      "A4 print for non-cash list and cash list",
      "Repeat table headers",
      "Hide interactive UI",
      "Show page numbers and printed timestamp"
    ],
    "css_snippet": "@media print {\n  @page { size: A4; margin: 12mm; }\n  body { background: white !important; }\n  .no-print { display: none !important; }\n  .print-only { display: block !important; }\n  table { width: 100%; border-collapse: collapse; }\n  thead { display: table-header-group; }\n  tfoot { display: table-footer-group; }\n  tr { break-inside: avoid; page-break-inside: avoid; }\n  .print-header { position: running(header); }\n  .print-muted { color: #444 !important; }\n}\n",
    "layout": {
      "header": "Store name, date (Asia/Kolkata), group (Card/Cheque/Bank/Other), printed at",
      "columns": "Serial, MMI Bill, Ref/UTR/Cheque No, Amount, Status, Notes",
      "footer": "Group totals + signature lines"
    }
  },

  "data_testid_convention": {
    "rule": "All interactive and key informational elements MUST include data-testid (kebab-case, role-based).",
    "examples": [
      "data-testid=\"login-form-submit-button\"",
      "data-testid=\"cashier-draft-tabs\"",
      "data-testid=\"bill-entry-mmi-input\"",
      "data-testid=\"payment-row-add-button\"",
      "data-testid=\"reconciliation-pending-only-toggle\"",
      "data-testid=\"reconciliation-row-serial-12\"",
      "data-testid=\"finalize-day-button\"",
      "data-testid=\"verified-tick-indicator\""
    ]
  },

  "image_urls": {
    "shell_texture_reference": [
      {
        "category": "shell-texture",
        "description": "Subtle green textile close-up reference (use as inspiration only; implement via CSS pattern/noise)",
        "url": "https://images.unsplash.com/photo-1601370690183-1c7796ecec61?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwxfHxlbWVyYWxkJTIwZ3JlZW4lMjBmYWJyaWMlMjB0ZXh0dXJlJTIwc3VidGxlJTIwd2VhdmV8ZW58MHx8fGdyZWVufDE3ODY0MzQyNjh8MA&ixlib=rb-4.1.0&q=85"
      }
    ]
  },

  "instructions_to_main_agent": [
    "Replace CRA default App.css centering/header styles; do not center the app container.",
    "Update /frontend/src/index.css :root tokens to match the provided HSL variables; keep radius <= 0.5rem.",
    "Implement shell texture class and apply ONLY to navigation/login/header wrappers.",
    "Use shadcn Table for dense grids; implement compact density by default; right-align amounts with tabular-nums.",
    "Implement Pending rows as filled red background across the entire row/cell group.",
    "Add print routes /print/noncash and /print/cash with dedicated layout and @media print CSS; ensure thead repeats.",
    "Use lucide-react icons with Tooltip for familiarity; avoid emoji icons.",
    "Ensure every button/input/toggle/filter/table row key info has data-testid in kebab-case.",
    "Avoid gradients except mild shell background accents under 20% viewport; never on tables/forms; never purple/pink combos.",
    "Mobile: add sticky bottom action bar for bill entry and cash count; ensure no horizontal overflow (use overflow-x-hidden on body wrapper if needed)."
  ]
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
