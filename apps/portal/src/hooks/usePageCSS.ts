import { useEffect } from 'react';

/**
 * Dynamically injects page-specific CSS link tags on mount and removes them on
 * unmount — replicating the legacy app's loadPageStylesheet behaviour so that
 * only the current page's CSS is active at any time.
 */
export function usePageCSS(cssUrls: string | string[]) {
  const urls = Array.isArray(cssUrls) ? cssUrls : [cssUrls];

  useEffect(() => {
    // Tear down any previous page-specific links before adding new ones.
    document.querySelectorAll('[data-page-css]').forEach(el => el.remove());

    const links = urls.map(url => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-page-css', '');
      document.head.appendChild(link);
      return link;
    });

    return () => links.forEach(link => link.remove());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join(',')]);
}
