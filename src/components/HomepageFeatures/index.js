import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Heron Overview',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    to: '/docs/heron/overview',
    description: (
      <>
        What Heron is, the apps and packages in the monorepo, and how the
        pieces fit together.
      </>
    ),
  },
  {
    title: 'How-To Guides',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    to: '/docs/guides/running-locally',
    description: (
      <>
        Task-focused walkthroughs — running Heron locally, adding a package,
        and other day-to-day workflows.
      </>
    ),
  },
  {
    title: 'Migration Guides',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    to: '/docs/migration/template',
    description: (
      <>
        Step-by-step guides for upgrading between versions and migrating
        breaking changes.
      </>
    ),
  },
];

function Feature({Svg, title, description, to}) {
  return (
    <div className={clsx('col col--4')}>
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
