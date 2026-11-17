import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";
import type { PluginAPI } from "tailwindcss/types/config";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	// La escala tipográfica es cerrada: cuatro tamaños y dos grosores. Los
  	// valores viven en src/index.css (--fs-*), compartidos con el CSS propio.
  	fontSize: {
  		xs: ['var(--fs-1)', { lineHeight: '1rem' }],
  		sm: ['var(--fs-2)', { lineHeight: '1.25rem' }],
  		xl: ['var(--fs-3)', { lineHeight: '1.75rem' }],
  		hero: ['var(--fs-hero)', { lineHeight: '1' }]
  	},
  	fontWeight: {
  		normal: '400',
  		medium: '500'
  	},
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'Plus Jakarta Sans',
  				'sans-serif'
  			],
  			mono: ['var(--font-mono)']
  		},
		colors: {
			blue: {
				DEFAULT: 'oklch(var(--accent-blue) / <alpha-value>)',
				50: 'hsl(214 95% 93%)',
				100: 'hsl(214 95% 85%)',
				200: 'hsl(213 97% 77%)',
				300: 'hsl(212 96% 68%)',
				400: 'hsl(213 94% 60%)',
				500: 'oklch(var(--accent-blue) / <alpha-value>)',
				600: 'hsl(221 83% 53%)',
				700: 'hsl(224 76% 48%)',
				800: 'hsl(226 71% 40%)',
				900: 'hsl(224 64% 33%)',
				950: 'hsl(226 57% 21%)'
			},
			rose: {
				...defaultColors.rose,
				500: 'oklch(var(--accent-rose) / <alpha-value>)'
			},
			emerald: {
				...defaultColors.emerald,
				500: 'oklch(var(--accent-emerald) / <alpha-value>)'
			},
			amber: {
				...defaultColors.amber,
				500: 'oklch(var(--accent-amber) / <alpha-value>)'
			},
			cyan: {
				...defaultColors.cyan,
				500: 'oklch(var(--accent-cyan) / <alpha-value>)'
			},
			violet: {
				...defaultColors.violet,
				500: 'oklch(var(--accent-violet) / <alpha-value>)'
			},
			fuchsia: 'hsl(292 76% 63%)',
			border: 'var(--border)',
			input: 'var(--input)',
			ring: 'var(--ring)',
			background: 'var(--background)',
			foreground: 'var(--foreground)',
			primary: {
				DEFAULT: 'var(--primary)',
				foreground: 'var(--primary-foreground)'
			},
			secondary: {
				DEFAULT: 'var(--secondary)',
				foreground: 'var(--secondary-foreground)'
			},
			destructive: {
				DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
				foreground: 'var(--destructive-foreground)'
			},
			success: 'oklch(var(--success) / <alpha-value>)',
			warning: {
				DEFAULT: 'hsl(var(--warning))',
				foreground: 'hsl(var(--warning-foreground))'
			},
			info: {
				DEFAULT: 'hsl(var(--info))',
				foreground: 'hsl(var(--info-foreground))'
			},
			muted: {
				DEFAULT: 'var(--muted)',
				foreground: 'var(--muted-foreground)'
			},
			accent: {
				DEFAULT: 'var(--accent)',
				foreground: 'var(--accent-foreground)'
			},
			popover: {
				DEFAULT: 'var(--popover)',
				foreground: 'var(--popover-foreground)'
			},
			card: {
				DEFAULT: 'var(--card)',
				foreground: 'var(--card-foreground)'
			},
			sidebar: {
				DEFAULT: 'var(--sidebar)',
				foreground: 'var(--sidebar-foreground)',
				primary: 'var(--sidebar-primary)',
				'primary-foreground': 'var(--sidebar-primary-foreground)',
				accent: 'var(--sidebar-accent)',
				'accent-foreground': 'var(--sidebar-accent-foreground)',
				border: 'var(--sidebar-border)',
				ring: 'var(--sidebar-ring)'
			},
			chart: {
				'1': 'var(--chart-1)',
				'2': 'var(--chart-2)',
				'3': 'var(--chart-3)',
				'4': 'var(--chart-4)',
				'5': 'var(--chart-5)'
			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  	}
  },
  plugins: [
    tailwindcssAnimate,
    function({ addUtilities }: PluginAPI) {
      const newUtilities = {
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;
