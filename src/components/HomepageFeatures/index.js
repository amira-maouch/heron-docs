import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'App Structure',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    to: '/docs/heron/app-structure',
    description: (
      <>
        Every file and folder in a Heron app — config, routes, widgets,
        translations — and what each one is for.
      </>
    ),
  },
  {
    title: 'How-To Guides',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    to: '/docs/guides/running-locally',
    description: (
      <>
        Task-focused walkthroughs — add a widget, wire up auth, use SSR, and
        other day-to-day workflows.
      </>
    ),
  },
  {
    title: 'Best Practices',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    to: '/docs/best-practices/ssr',
    description: (
      <>
        Patterns worth following for SEO, SSR, and widget APIs once the
        basics click.
      </>
    ),
  },
  {
    title: 'Migration Guides',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    to: '/docs/migration/main-to-ssr',
    description: (
      <>
        Step-by-step guides for upgrading between versions, starting with
        main → the SSR branch.
      </>
    ),
  },
];

function Feature({Svg, title, description, to}) {
  return (
    <div className={clsx('col col--3')}>
      <Link to={to} className={styles.featureLink}>
        <div className="text--center">
          <Svg className={styles.featureSvg} role="img" />
        </div>
        <div className="text--center padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </Link>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
