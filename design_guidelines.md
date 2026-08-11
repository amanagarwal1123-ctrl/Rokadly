{
  "meta": {
    "app": "Rokadly",
    "scope": "VISUAL THEME ONLY — do not break functionality",
    "theme": "Single dark jewel-tone theme (no light mode)",
    "non_negotiables": [
      "NO WHITE BACKGROUNDS ANYWHERE in the app UI (except @media print output)",
      "Operational meaning preserved: ruby=negative/pending, emerald=verified/positive, sapphire=neutral/base",
      "Gold/brass used as zardozi accent for borders/dividers/focus",
      "No glassmorphism over tables; keep dense data readable",
      "No purple gradients; gradients must not exceed 20% viewport",
      "Cards radius ≤ 8px"
    ]
  },

  "brand_personality": {
    "keywords": [
      "Indian luxury jewellery",
      "couture craftsmanship",
      "Mughal architecture",
      "jaali lattice",
      "zardozi brass thread",
      "deep sapphire ink",
      "high-contrast data clarity"
    ],
    "visual_metaphor": "A midnight-sapphire ledger book wrapped in Mughal jaali + scalloped arch framing, with brass hairlines and gemstone status inlays (ruby/emerald).",
    "density_principle": "Ornament lives in the shell + edges; data surfaces stay calm, matte, and readable."
  },

  "typography": {
    "decision": "Keep existing pairing (Space Grotesk display + IBM Plex Sans + IBM Plex Mono).",
    "fonts": {
      "display": {
        "name": "Space Grotesk",
        "usage": "Page titles, KPI numbers, section headers"
      },
      "body": {
        "name": "IBM Plex Sans",
        "usage": "Forms, tables, labels"
      },
      "mono": {
        "name": "IBM Plex Mono",
        "usage": "Amounts, IDs, cheque numbers, audit log timestamps"
      }
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight",
      "h2": "text-base md:text-lg font-medium",
      "body": "text-sm md:text-base leading-6",
      "small": "text-xs text-muted-foreground",
      "numeric": "font-mono-num tabular-nums"
    }
  },

  "design_tokens": {
    "implementation_notes": [
      "All values are HSL triplets for shadcn tokens (no commas).",
      "Set :root to dark theme only; remove/ignore light theme assumptions.",
      "Avoid pure black; use ink-sapphire to reduce eye strain.",
      "Use --brass for hairline borders and focus rings; keep it subtle (not neon gold)."
    ],

    "token_table_old_to_new_hsl": {
      "--background": { "old": "36 33% 98%", "new": "222 52% 7%" },
      "--foreground": { "old": "220 13% 12%", "new": "38 28% 92%" },

      "--card": { "old": "36 33% 99%", "new": "222 44% 10%" },
      "--card-foreground": { "old": "220 13% 12%", "new": "38 28% 92%" },

      "--popover": { "old": "36 33% 99%", "new": "222 44% 10%" },
      "--popover-foreground": { "old": "220 13% 12%", "new": "38 28% 92%" },

      "--primary": { "old": "220 13% 12%", "new": "210 78% 56%" },
      "--primary-foreground": { "old": "36 33% 98%", "new": "222 52% 7%" },

      "--secondary": { "old": "36 18% 94%", "new": "222 30% 14%" },
      "--secondary-foreground": { "old": "220 13% 12%", "new": "38 28% 92%" },

      "--muted": { "old": "36 18% 94%", "new": "222 26% 13%" },
      "--muted-foreground": { "old": "220 8% 42%", "new": "220 12% 70%" },

      "--accent": { "old": "36 18% 94%", "new": "214 55% 16%" },
      "--accent-foreground": { "old": "220 13% 12%", "new": "38 28% 92%" },

      "--destructive": { "old": "350 72% 38%", "new": "350 78% 46%" },
      "--destructive-foreground": { "old": "36 33% 98%", "new": "38 28% 96%" },

      "--border": { "old": "36 12% 86%", "new": "43 38% 34%" },
      "--input": { "old": "36 12% 86%", "new": "222 24% 18%" },
      "--ring": { "old": "220 13% 12%", "new": "43 62% 52%" },

      "--radius": { "old": "0.5rem", "new": "0.5rem" },

      "--ruby": { "old": "350 72% 38%", "new": "350 78% 46%" },
      "--ruby-foreground": { "old": "36 33% 98%", "new": "38 28% 96%" },

      "--emerald": { "old": "154 55% 28%", "new": "154 62% 38%" },
      "--emerald-foreground": { "old": "36 33% 98%", "new": "38 28% 96%" },

      "--brass": { "old": "43 52% 46%", "new": "43 62% 52%" },
      "--brass-foreground": { "old": "220 13% 12%", "new": "222 52% 7%" },

      "--danger": { "old": "350 72% 38%", "new": "350 78% 46%" },
      "--danger-foreground": { "old": "36 33% 98%", "new": "38 28% 96%" },

      "--success": { "old": "154 55% 28%", "new": "154 62% 38%" },
      "--success-foreground": { "old": "36 33% 98%", "new": "38 28% 96%" },

      "--warning": { "old": "38 92% 45%", "new": "38 92% 52%" },
      "--warning-foreground": { "old": "220 13% 12%", "new": "222 52% 7%" },

      "--info": { "old": "205 70% 38%", "new": "210 78% 56%" },
      "--info-foreground": { "old": "36 33% 98%", "new": "222 52% 7%" },

      "--chart-1": { "old": "350 72% 38%", "new": "350 78% 46%" },
      "--chart-2": { "old": "154 55% 28%", "new": "154 62% 38%" },
      "--chart-3": { "old": "43 52% 46%", "new": "43 62% 52%" },
      "--chart-4": { "old": "205 70% 38%", "new": "210 78% 56%" },
      "--chart-5": { "old": "38 92% 45%", "new": "38 92% 52%" }
    },

    "additional_custom_tokens_to_add": {
      "--sapphire": "210 78% 56%",
      "--sapphire-2": "214 70% 42%",
      "--ink": "222 52% 7%",
      "--surface": "222 44% 10%",
      "--surface-2": "222 30% 14%",
      "--brass-dim": "43 38% 34%",
      "--focus": "43 62% 52%",
      "--shadow": "222 60% 3%"
    },

    "css_custom_properties_snippet": "/* index.css :root (dark jewel theme) */\n:root {\n  --background: 222 52% 7%;\n  --foreground: 38 28% 92%;\n  --card: 222 44% 10%;\n  --card-foreground: 38 28% 92%;\n  --popover: 222 44% 10%;\n  --popover-foreground: 38 28% 92%;\n  --primary: 210 78% 56%;\n  --primary-foreground: 222 52% 7%;\n  --secondary: 222 30% 14%;\n  --secondary-foreground: 38 28% 92%;\n  --muted: 222 26% 13%;\n  --muted-foreground: 220 12% 70%;\n  --accent: 214 55% 16%;\n  --accent-foreground: 38 28% 92%;\n  --destructive: 350 78% 46%;\n  --destructive-foreground: 38 28% 96%;\n  --border: 43 38% 34%;\n  --input: 222 24% 18%;\n  --ring: 43 62% 52%;\n  --radius: 0.5rem;\n\n  --ruby: 350 78% 46%;\n  --ruby-foreground: 38 28% 96%;\n  --emerald: 154 62% 38%;\n  --emerald-foreground: 38 28% 96%;\n  --brass: 43 62% 52%;\n  --brass-foreground: 222 52% 7%;\n\n  --danger: 350 78% 46%;\n  --danger-foreground: 38 28% 96%;\n  --success: 154 62% 38%;\n  --success-foreground: 38 28% 96%;\n  --warning: 38 92% 52%;\n  --warning-foreground: 222 52% 7%;\n  --info: 210 78% 56%;\n  --info-foreground: 222 52% 7%;\n\n  --chart-1: 350 78% 46%;\n  --chart-2: 154 62% 38%;\n  --chart-3: 43 62% 52%;\n  --chart-4: 210 78% 56%;\n  --chart-5: 38 92% 52%;\n\n  --sapphire: 210 78% 56%;\n  --sapphire-2: 214 70% 42%;\n  --ink: 222 52% 7%;\n  --surface: 222 44% 10%;\n  --surface-2: 222 30% 14%;\n  --brass-dim: 43 38% 34%;\n  --focus: 43 62% 52%;\n  --shadow: 222 60% 3%;\n}\n"
  },

  "textures_css_only": {
    "rules": [
      "Use textures via ::before/::after overlays with pointer-events:none.",
      "Keep opacity low on data surfaces (cards/tables): 0.03–0.06.",
      "Shell areas (sidebar/header/login) can go 0.08–0.14.",
      "Prefer mix-blend-mode: overlay/soft-light; avoid reducing text contrast.",
      "All patterns are inline SVG data-URIs (no external assets)."
    ],

    "svg_data_uri_patterns": {
      "jaali_lattice_tile": {
        "description": "Geometric jaali lattice (diamond + dots). Use as subtle all-over texture.",
        "data_uri": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg fill='none' stroke='%23D6B36A' stroke-opacity='0.55' stroke-width='1'%3E%3Cpath d='M48 6 L90 48 L48 90 L6 48 Z'/%3E%3Cpath d='M48 -42 L138 48 L48 138 L-42 48 Z'/%3E%3Cpath d='M48 54 L90 96 L48 138 L6 96 Z'/%3E%3C/g%3E%3Cg fill='%23D6B36A' fill-opacity='0.35'%3E%3Ccircle cx='48' cy='48' r='1.6'/%3E%3Ccircle cx='48' cy='6' r='1.2'/%3E%3Ccircle cx='90' cy='48' r='1.2'/%3E%3Ccircle cx='48' cy='90' r='1.2'/%3E%3Ccircle cx='6' cy='48' r='1.2'/%3E%3C/g%3E%3C/svg%3E"
      },
      "scalloped_arch_border": {
        "description": "Scalloped Mughal arch border motif (use as top/bottom strip or header underline).",
        "data_uri": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='48' viewBox='0 0 240 48'%3E%3Cpath d='M0 36 Q24 12 48 36 T96 36 T144 36 T192 36 T240 36' fill='none' stroke='%23D6B36A' stroke-opacity='0.75' stroke-width='2'/%3E%3Cpath d='M0 44 H240' stroke='%23D6B36A' stroke-opacity='0.45' stroke-width='1'/%3E%3Ccircle cx='24' cy='36' r='1.5' fill='%23D6B36A' fill-opacity='0.55'/%3E%3Ccircle cx='72' cy='36' r='1.5' fill='%23D6B36A' fill-opacity='0.55'/%3E%3Ccircle cx='120' cy='36' r='1.5' fill='%23D6B36A' fill-opacity='0.55'/%3E%3Ccircle cx='168' cy='36' r='1.5' fill='%23D6B36A' fill-opacity='0.55'/%3E%3Ccircle cx='216' cy='36' r='1.5' fill='%23D6B36A' fill-opacity='0.55'/%3E%3C/svg%3E"
      },
      "paisley_sprig": {
        "description": "Tiny paisley/floral sprig (use sparingly on login hero + empty states).",
        "data_uri": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23D6B36A' stroke-opacity='0.55'%3E%3Cpath d='M92 34c18 10 26 30 16 48-8 14-24 18-38 10 10 18 6 38-10 48-18 12-42 2-50-18-10-26 10-54 40-62 10-2 20-2 30 2-10-10-8-22 12-28z' stroke-width='1.2'/%3E%3Cpath d='M78 62c10 6 14 16 8 26-6 10-18 12-28 6' stroke-width='1'/%3E%3Cpath d='M62 104c8 6 10 14 4 22' stroke-width='1'/%3E%3C/g%3E%3Ccircle cx='104' cy='44' r='2' fill='%23D6B36A' fill-opacity='0.35'/%3E%3C/svg%3E"
      },
      "noise_grain": {
        "description": "Soft grain overlay (already similar exists in App.css).",
        "data_uri": "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E"
      }
    },

    "where_to_apply": {
      "a_app_background": {
        "base": "bg-[hsl(var(--background))]",
        "overlay": "jaali_lattice_tile @ opacity 0.04, mix-blend-mode: soft-light",
        "note": "This ensures NO white anywhere; background stays ink-sapphire."
      },
      "b_cards": {
        "base": "bg-[hsl(var(--card))]",
        "overlay": "jaali_lattice_tile @ opacity 0.03 + noise_grain @ opacity 0.04",
        "border": "1px solid hsl(var(--border) / 0.55)"
      },
      "c_sidebar_header_shell": {
        "base": "bg-[hsl(222_52%_6%)]",
        "overlay": "jaali_lattice_tile @ opacity 0.10 + scalloped_arch_border as header underline",
        "accent": "brass hairlines + sapphire active pill"
      },
      "d_login_hero": {
        "base": "radial-gradient(1200px circle at 20% 10%, hsl(214 70% 18%) 0%, hsl(222 52% 7%) 55%, hsl(222 52% 6%) 100%)",
        "overlay": "paisley_sprig @ opacity 0.10 + noise_grain @ opacity 0.06",
        "note": "Gradient area limited to hero only (<20% viewport on desktop; on mobile keep it as top band)."
      }
    }
  },

  "component_treatments": {
    "component_path": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "alert_dialog": "/app/frontend/src/components/ui/alert-dialog.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "sheet_drawer": "/app/frontend/src/components/ui/sheet.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx"
    },

    "global_surface_rules": {
      "no_white": "Never use bg-white, text-black defaults, or white cards. Replace with bg-[hsl(var(--card))] / bg-[hsl(var(--background))].",
      "radius": "Cards, dialogs, inputs: rounded-md (8px). Avoid rounded-xl.",
      "borders": "Use brass-dim hairlines: border-[hsl(var(--border)/0.55)] and separators with border-[hsl(var(--border)/0.35)].",
      "shadows": "Use subtle shadow only: shadow-[0_10px_30px_hsl(var(--shadow)/0.55)]. No glow on tables."
    },

    "buttons": {
      "primary": {
        "style": "Sapphire fill with brass focus ring",
        "tailwind": "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--sapphire-2))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0",
        "micro_interaction": "hover: slight lift (translateY -1px) ONLY on buttons (not tables); active: scale-95",
        "data_testid_examples": [
          "data-testid=\"primary-action-button\"",
          "data-testid=\"login-submit-button\""
        ]
      },
      "secondary": {
        "tailwind": "bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.55)] hover:bg-[hsl(var(--accent))]",
        "note": "Secondary should feel like matte fabric, not glass."
      },
      "ghost": {
        "tailwind": "bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
      },
      "destructive": {
        "tailwind": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))] hover:bg-[hsl(350_78%_40%)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
        "note": "Ruby is reserved for negative actions + pending rows."
      },
      "success": {
        "tailwind": "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(154_62%_32%)]",
        "usage": "Verify/Finalize/Matched actions only"
      }
    },

    "inputs_forms": {
      "input_base": {
        "tailwind": "bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.55)] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0",
        "note": "Avoid bright inner shadows; keep matte."
      },
      "label": "text-xs font-medium tracking-wide text-[hsl(var(--muted-foreground))]",
      "helper_error": {
        "tailwind": "text-[hsl(var(--ruby))]",
        "data_testid": "data-testid=\"field-error-text\""
      }
    },

    "tables_dense_finance": {
      "table_container": "rounded-md border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card))]",
      "thead": "bg-[hsl(var(--surface-2))] text-[hsl(var(--muted-foreground))]",
      "row_hover": "hover:bg-[hsl(var(--accent)/0.55)]",
      "zebra": "odd:bg-[hsl(var(--card))] even:bg-[hsl(var(--surface))]",
      "pending_rows": {
        "must_keep": "Existing .pending-row behavior: filled ruby background with white text.",
        "tailwind_equivalent": "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]",
        "accessibility": "Pending rows must keep white-ish text (danger-foreground) for AA."
      },
      "matched_rows": {
        "tailwind": "bg-[hsl(var(--emerald)/0.10)]",
        "note": "Keep subtle; do not turn whole table green."
      },
      "amount_cells": {
        "positive": "text-[hsl(var(--emerald))] font-semibold font-mono-num",
        "negative": "text-[hsl(var(--ruby))] font-semibold font-mono-num",
        "neutral": "text-[hsl(var(--foreground))] font-mono-num"
      },
      "sticky_header": "Ensure sticky thead uses bg-[hsl(var(--surface-2))] not --background (since background is very dark).",
      "data_testid_examples": [
        "data-testid=\"reconciliation-table\"",
        "data-testid=\"pending-row\"",
        "data-testid=\"amount-cell\""
      ]
    },

    "badges_status_chips": {
      "verified": "bg-[hsl(var(--emerald)/0.18)] text-[hsl(var(--emerald))] border border-[hsl(var(--emerald)/0.35)]",
      "pending": "bg-[hsl(var(--ruby)/0.18)] text-[hsl(var(--ruby))] border border-[hsl(var(--ruby)/0.35)]",
      "info": "bg-[hsl(var(--info)/0.18)] text-[hsl(var(--info))] border border-[hsl(var(--info)/0.35)]",
      "warning": "bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.35)]"
    },

    "tabs_draft_workspace": {
      "concept": "Temple-notch / arch accent for active tab using ::after brass hairline + sapphire underline.",
      "active": "text-[hsl(var(--foreground))] bg-[hsl(var(--surface-2))] border border-[hsl(var(--border)/0.55)]",
      "inactive": "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
      "micro_interaction": "Active tab slides underline (200ms) — transition-[width,transform,opacity] only."
    },

    "dialogs_drawers": {
      "surface": "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.55)] shadow-[0_18px_60px_hsl(var(--shadow)/0.65)]",
      "header_ornament": "Add scalloped_arch_border as subtle underline strip (opacity 0.35).",
      "backdrop": "bg-black/60 (no blur needed; keep crisp for data entry).",
      "data_testid_examples": [
        "data-testid=\"dialog-confirm-button\"",
        "data-testid=\"dialog-cancel-button\""
      ]
    },

    "sidebar_nav": {
      "base": "Use existing .shell-texture but update its base color to ink-sapphire and overlay jaali.",
      "nav_item": {
        "default": "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent)/0.55)]",
        "active": "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] border border-[hsl(var(--border)/0.55)]",
        "active_marker": "Left brass hairline: before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-[hsl(var(--brass))]"
      },
      "section_dividers": "Use Separator with border-[hsl(var(--border)/0.35)] and optional scalloped underline in headers."
    },

    "toasts": {
      "library": "sonner",
      "style": "Toasts should be card surface with brass border; success uses emerald dot; error uses ruby dot.",
      "data_testid": "data-testid=\"toast-message\""
    }
  },

  "ornamental_details_css": {
    "card_hairline": {
      "description": "Zardozi brass hairline border + corner glint.",
      "css": ".card-zardozi{position:relative;}\n.card-zardozi:before{content:'';position:absolute;inset:0;border-radius:8px;pointer-events:none;border:1px solid hsl(var(--border)/0.55);}\n.card-zardozi:after{content:'';position:absolute;inset:0;border-radius:8px;pointer-events:none;background:linear-gradient(135deg, hsl(var(--brass)/0.22), transparent 35%, transparent 65%, hsl(var(--brass)/0.14));mix-blend-mode:overlay;opacity:.55;}"
    },
    "section_header_arch": {
      "description": "Arch-shaped accent behind section titles (subtle, not a big banner).",
      "css": ".arch-title{position:relative;display:inline-flex;align-items:center;gap:.5rem;padding:.25rem .5rem;}\n.arch-title:before{content:'';position:absolute;inset:-6px -10px -8px -10px;border-radius:999px 999px 10px 10px;background:hsl(var(--accent));border:1px solid hsl(var(--border)/0.55);opacity:.9;}\n.arch-title>*{position:relative;z-index:1;}"
    },
    "shell_jaali_overlay": {
      "css": ".shell-jaali{position:relative;}\n.shell-jaali:before{content:'';position:absolute;inset:0;pointer-events:none;background-image:url('<<jaali_lattice_tile>>');background-size:96px 96px;opacity:.12;mix-blend-mode:overlay;}\n.shell-jaali:after{content:'';position:absolute;inset:0;pointer-events:none;background-image:url('<<noise_grain>>');opacity:.06;mix-blend-mode:soft-light;}"
    }
  },

  "accessibility_contrast_pairs": {
    "body_text": {
      "bg": "--card (222 44% 10%)",
      "fg": "--foreground (38 28% 92%)",
      "note": "High contrast without pure white glare."
    },
    "muted_text": {
      "bg": "--card",
      "fg": "--muted-foreground (220 12% 70%)",
      "usage": "Table headers, helper text"
    },
    "positive_money": {
      "bg": "--card",
      "fg": "--emerald (154 62% 38%)",
      "note": "Use font-semibold + mono for legibility."
    },
    "negative_money": {
      "bg": "--card",
      "fg": "--ruby (350 78% 46%)",
      "note": "Never use ruby for neutral labels; reserve for negative."
    },
    "pending_row": {
      "bg": "--danger (350 78% 46%)",
      "fg": "--danger-foreground (38 28% 96%)",
      "note": "Must remain filled red with light text."
    },
    "focus_state": {
      "ring": "--ring (43 62% 52%)",
      "note": "Brass ring is visible on dark surfaces; do not remove outlines."
    }
  },

  "page_specific_notes": {
    "login": {
      "layout": "Split panel on desktop; stacked on mobile.",
      "hero": "Use login hero gradient + paisley overlay; keep form panel as card surface (no white).",
      "cta": "Primary sapphire button; secondary as matte surface.",
      "data_testid": [
        "data-testid=\"login-username-input\"",
        "data-testid=\"login-password-input\"",
        "data-testid=\"login-submit-button\""
      ]
    },
    "dashboards": {
      "kpis": "KPI cards use card-zardozi hairline; one sapphire accent per row; avoid rainbow.",
      "charts": "Use chart tokens; keep gridlines brass-dim at low opacity."
    },
    "bill_entry_workspace": {
      "draft_tabs": "Tabs get arch-title accent for active; keep dense spacing.",
      "sticky_actions": "Existing .sticky-actions should use bg-[hsl(var(--background)/0.92)] and border brass-dim."
    },
    "reconciliation_non_cash": {
      "pending_rows": "Keep strong filled ruby rows (already .pending-row). Ensure hover stays ruby-dark.",
      "numbered_rows": "Use muted sapphire separators; avoid bright borders."
    },
    "rokad_register": {
      "verified_ticks": "Use emerald icon + badge; do not use neon green.",
      "verified_row": "Optional subtle emerald wash (0.06–0.10)."
    },
    "admin_store_comparison": {
      "comparison_tables": "Use zebra surfaces; highlight deltas with ruby/emerald amounts only."
    },
    "audit_log": {
      "mono": "Use IBM Plex Mono for timestamps/IDs; muted foreground for metadata."
    },
    "print_pages": {
      "on_screen_preview": "Use parchment/champagne preview background (NOT stark white): e.g., bg-[hsl(38_35%_88%)] with subtle noise.",
      "media_print": "@media print MUST remain white paper with black text for photocopy friendliness (already in App.css).",
      "pending_rows_in_print": "Pending rows become light gray with black text (already implemented)."
    }
  },

  "layout_grid_spacing": {
    "principles": [
      "Mobile-first: single column; tables scroll horizontally inside ScrollArea.",
      "Use 2–3x more spacing than current in shell areas; keep table density compact.",
      "Avoid centered app container; keep left-aligned reading flow."
    ],
    "spacing_tokens": {
      "page_padding": "px-3 sm:px-4 lg:px-6",
      "section_gap": "space-y-4 lg:space-y-6",
      "card_padding": "p-3 sm:p-4",
      "table_cell": "Use existing .table-compact (th 2.25rem, td 0.375rem 0.5rem)."
    }
  },

  "motion_micro_interactions": {
    "rules": [
      "No transition: all.",
      "Use transitions only on color, background-color, border-color, opacity, box-shadow.",
      "Avoid transforms on table rows (can cause jitter with sticky headers)."
    ],
    "recommended": {
      "buttons": "transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-out active:scale-95",
      "nav_items": "transition-[background-color,color,border-color] duration-150",
      "dialogs": "Use shadcn default animations; keep subtle."
    }
  },

  "image_urls": {
    "note": "No external images required; all ornamentation is CSS-only SVG patterns per requirement.",
    "categories": []
  },

  "instructions_to_main_agent": [
    "Update /app/frontend/src/index.css :root tokens to the NEW HSL values (dark jewel theme).",
    "Ensure body bg uses --background (ink-sapphire). Remove any bg-white usage across pages/components.",
    "Update .shell-texture base background in App.css to match --background/--surface and replace current woven gradients with jaali overlay per textures section.",
    "Apply texture overlays via utility classes (shell-jaali, card-zardozi) on shell containers and Card wrappers; keep opacity low on data surfaces.",
    "Keep .pending-row filled ruby with light text; ensure sticky thead uses surface-2 background.",
    "Add brass focus rings (ring token) to all inputs/buttons; do not remove outlines.",
    "Ensure every interactive + key informational element has data-testid in kebab-case (buttons, inputs, tabs, nav links, table rows with status, totals).",
    "Print: keep @media print white paper; on-screen preview can be parchment but must not affect print output."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
