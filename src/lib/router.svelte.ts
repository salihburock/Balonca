export type Route = 'home' | 'watch' | 'words' | 'help' | 'notfound';
const ROUTES: Route[] = ['home', 'watch', 'words', 'help'];

function parse(): Route {
  const seg = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'home';
  return (ROUTES as string[]).includes(seg) ? (seg as Route) : 'notfound';
}

export const router = $state({ route: parse() });

addEventListener('hashchange', () => {
  router.route = parse();
  scrollTo(0, 0);
});
