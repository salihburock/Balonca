export type Route = 'home' | 'watch' | 'words' | 'help' | 'notfound';
const ROUTES: Route[] = ['home', 'watch', 'words', 'help'];

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const seg = path.split('/')[0] || 'home';
  return {
    route: ((ROUTES as string[]).includes(seg) ? seg : 'notfound') as Route,
    params: new URLSearchParams(query),
  };
}

export const router = $state(parse());

addEventListener('hashchange', () => {
  const next = parse();
  if (next.route !== router.route) scrollTo(0, 0);
  router.route = next.route;
  router.params = next.params;
});

export const watchUrl = (id: string, t = 0) => `#/watch?v=${id}${t ? `&t=${Math.max(0, Math.floor(t))}` : ''}`;
