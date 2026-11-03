const config = {
  mongodb: {
    url: process.env.MONGODB_URI,
    databaseName: process.env.MONGODB_DB_NAME ?? 'laprizza', // same as database.js
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  lockTtl: 0,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'esm',
};

export default config;