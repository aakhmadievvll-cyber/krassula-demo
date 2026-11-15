// Yandex Metrika counter. Put the counter number here (digits from metrika.yandex.ru, it is not a
// secret: it is visible in every page that has the counter) and run `scripts/deploy.sh release`.
// While it is empty the site sets no cookies and shows no cookie banner.
export const METRIKA = Object.freeze({
  counterId: '',
  // Data is sent only from the real site, so local previews do not end up in the reports.
  hosts: Object.freeze(['krassula-gift.ru', 'www.krassula-gift.ru']),
});
