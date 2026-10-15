// Every blog post, newest first. The home page sidebar and /blog both read this list.
// date: 'YYYY-MM' (month the post went up). To add a post: create src/pages/blog/<slug>.astro and add an entry here.
export interface Post {
  slug: string;
  title: string;
  date: string;
  photo: string;
  alt: string;
  caption: string;
}

export const posts: Post[] = [
  {
    slug: 'trail-range',
    title: 'Trading mpg for clearance',
    date: '2026-10',
    photo: '/photos/trail-range.jpg',
    alt: 'Off-road geometry score vs EPA combined MPG, Pareto frontier',
    caption: 'How much of a mileage hit am I willing to take to feel like I can go off-road',
  },
  {
    slug: 'ptfe-dry-electrode',
    title: 'Is all PTFE the same for dry electrode processing?',
    date: '2026-05',
    photo: '/research/thumbs/ptfe_dry_electrode.png',
    alt: 'Rendering of fibrillated PTFE strands forming a mycelium-like network under shear',
    caption: 'Not all PTFE is made the same',
  },
  {
    slug: '45x-map',
    title: "Where the IRA's $5.6B in battery 45X has actually gone",
    date: '2026-05',
    photo: '/research/thumbs/45x_map.png',
    alt: 'Geographic map of US battery supply chain plants colored by product type and sized by Section 45X recipient share',
    caption: 'Interactive map of cumulative ($5.6B), publicly disclosed 45X credits to cell, pack, cathode, anode, and mineral producers.',
  },
  {
    slug: 'mache-natural-experiment',
    title: 'Mustang Mach E Material Flows',
    date: '2026-05',
    photo: '/research/thumbs/mache_er_nmc.png',
    alt: 'Sankey diagram of the Mustang Mach-E Extended Range NMC battery supply chain from mine to pack',
    caption: 'Two Mach-E trims, same Cuautitlán line, very different chains. Interactive flows from mining to pack.',
  },
  {
    slug: 'mountain-biking',
    title: 'Bikepacking',
    date: '2026-04',
    photo: '/photos/homies-on-bikes.jpeg',
    alt: 'Homies on bikes',
    caption: 'commuting, bikepacking, road riding, mountain biking, cargo bikes, bike bags, friends on bikes...',
  },
  {
    slug: 'sewing',
    title: 'You can sew leather',
    date: '2026-04',
    photo: '/photos/wallet.jpeg',
    alt: 'Handmade wallet',
    caption: 'Bike bags, wallets, jackets, shirts, shackets (jirts?), laser-patterns, zippers, velcro (love).',
  },
  {
    slug: 'van',
    title: 'My Vanagon has a Subaru problem',
    date: '2026-04',
    photo: '/photos/van.jpg',
    alt: '1985 Volkswagen Vanagon Westfalia',
    caption: 'I bought a Westy in high school and swapped in a Subaru engine while I was in college. Lived in it through a Michigan winter and my brother drove it to California.',
  },
];

export function fmtDate(d: string): string {
  const [y, m] = d.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}
