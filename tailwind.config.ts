import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
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
  			mono: [
  				'JetBrains Mono',
  				'monospace'
  			]
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
			cyan: 'hsl(188 86% 43%)',
			violet: 'hsl(258 90% 66%)',
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
			success: {
				DEFAULT: 'hsl(var(--success))',
				foreground: 'hsl(var(--success-foreground))'
			},
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
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'collapsible-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-collapsible-content-height)'
  				}
  			},
  			'collapsible-up': {
  				from: {
  					height: 'var(--radix-collapsible-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			shimmer: {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			},
  			breathe: {
  				'0%, 100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				},
  				'50%': {
  					transform: 'scale(1.08)',
  					opacity: '0.85'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-8px)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'collapsible-down': 'collapsible-down 0.2s ease-out',
  			'collapsible-up': 'collapsible-up 0.2s ease-out',
  			shimmer: 'shimmer 2s infinite',
  			breathe: 'breathe 2s ease-in-out infinite',
  			float: 'float 3s ease-in-out infinite'
  		},
  		spacing: {
  			'safe-top': 'env(safe-area-inset-top)',
  			'safe-bottom': 'env(safe-area-inset-bottom)',
  			'safe-left': 'env(safe-area-inset-left)',
  			'safe-right': 'env(safe-area-inset-right)'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }: any) {
      const newUtilities = {
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.mb-safe': {
          marginBottom: 'env(safe-area-inset-bottom)',
        },
        '.mt-safe': {
          marginTop: 'env(safe-area-inset-top)',
        },
        /* Fila que se arrastra de lado sin mostrar la barra de scroll. */
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;
