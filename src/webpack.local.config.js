const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const hasha = require('hasha');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const WebpackBar = require('webpackbar');
const webpack = require('webpack');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BundleAnalyzer = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const smp = new SpeedMeasurePlugin();

const distOutputPath = 'dist';
const appPrefix = 'ai_eval_web';

// 环境变量：注入全部 process.env / CLI env 到前端
function resolveClientEnv(raw, cliEnv) {
  const assignedEnv = Object.assign({}, cliEnv, process.env);
  const env = {};
  Object.keys(assignedEnv).forEach(key => {
    const value = assignedEnv[key];
    if (value === undefined) return;
    env[key] = value;
  });

  if (raw) {
    return env;
  }

  for (const key in env) {
    env[key] = JSON.stringify(env[key]);
  }
  return {
    'process.env': env,
  };
}

const getLocalIdent = ({ resourcePath }, localIdentName, localName) => {
  if (localName === appPrefix) {
    return localName;
  }
  if (/\.global\.(css|less)$/.test(resourcePath) || /node_modules/.test(resourcePath)) {
    return localName;
  }
  return `${localName}__${hasha(resourcePath + localName, { algorithm: 'md5' }).slice(0, 8)}`;
};

module.exports = (cliEnv = {}, argv) => {
  const mode = argv.mode || 'development';
  const { ANALYZER_PACKAGE } = cliEnv;

  if (!['production', 'development'].includes(mode)) {
    throw new Error('The mode is required for NODE_ENV, BABEL_ENV but was not specified.');
  }

  const isProd = mode === 'production';
  const isDev = mode === 'development';
  const classNamesConfig = {
    loader: '@ecomfe/class-names-loader',
    options: {
      classNamesModule: require.resolve('classnames'),
    },
  };

  const extractOrStyleLoaderConfig = isProd
    ? MiniCssExtractPlugin.loader
    : {
        loader: 'style-loader',
        options: { injectType: 'singletonStyleTag' },
      };

  const lessLoaderConfig = {
    loader: 'less-loader',
  };

  const cssLoaderConfig = {
    loader: 'css-loader',
    options: {
      modules: {
        getLocalIdent,
      },
      importLoaders: 1,
    },
  };

  const getPostcssLoaderConfig = useNamespace => {
    const config = require('../postcss.config.js');
    if (isProd) {
      config.plugins.cssnano = {
        preset: 'default',
      };
    }
    if (useNamespace) {
      config.plugins['postcss-selector-namespace'] = {
        namespace: `#${appPrefix}`,
      };
    }
    return {
      loader: 'postcss-loader',
      options: {
        postcssOptions: config,
      },
    };
  };

  const webpackConfig = {
    entry: './main.tsx',
    mode: isProd ? 'production' : 'development',
    output: isProd
      ? {
          filename: 'js/main.js',
          chunkFilename: 'js/[name].js',
          path: path.resolve(__dirname, distOutputPath),
          publicPath: './',
          assetModuleFilename: (pathData) => {
            const filename = pathData.filename || '';
            if (filename.endsWith('.css')) {
              return 'css/main.css';
            }
            return 'assets/[name]-[hash][ext][query]';
          },
        }
      : {
          filename: 'main/[name].[id:4].js',
          path: path.resolve(__dirname, distOutputPath),
          publicPath: '/',
          chunkFilename: '[name].chunk.js',
        },
    ...(isDev && {
      devtool: 'source-map',
    }),
    resolve: {
      extensions: ['.js', '.css', '.jsx', '.tsx', '.ts'],
      alias: {
        '@': path.resolve(__dirname, '../src'),
      },
      fallback: {
        fs: false,
        tls: false,
        net: false,
        path: false,
        zlib: false,
        http: false,
        https: false,
        child_process: false,
        crypto: false,
        url: false,
        buffer: false,
      },
    },
    devServer: {
      client: {
        overlay: {
          runtimeErrors: false,
        },
      },
      port: 8000,
      static: {
        directory: path.resolve(__dirname, '../dist'),
        serveIndex: true,
        watch: true,
      },
      webSocketServer: 'ws',
      historyApiFallback: {
        disableDotRule: true,
        index: '/',
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      },
      proxy: {
        // testinfra-admin 后端
        '/api/admin': {
          target: 'http://192.168.178.116:8080/testinfra-admin',
          changeOrigin: true,
          // 网关对带 Origin 头的写请求(POST/PUT/DELETE)返回 403，
          // 开发环境通过代理转发时移除 Origin 头以规避（生产需后端网关配置 CORS 白名单）
          onProxyReq: (proxyReq) => {
            proxyReq.removeHeader('origin');
          },
        },
        // Langfuse NextAuth 登录
        '/api/auth': {
          target: 'http://192.168.178.116:8090',
          changeOrigin: true,
          cookieDomainRewrite: '',
        },
        // Langfuse tRPC
        '/api/trpc': {
          target: 'http://192.168.178.116:8090',
          changeOrigin: true,
        },
        // repo制品库上传地址
        '/repo': {
          target: 'http://192.168.182.47:8000',
          changeOrigin: true,
        }
      },
    },
    plugins: [
      new WebpackBar(),
      ANALYZER_PACKAGE && new BundleAnalyzer(),
      new webpack.DefinePlugin({
        ...resolveClientEnv(false, cliEnv),
        'process.version': JSON.stringify(''),
        'import.meta.env.BASE_URL': JSON.stringify(isProd ? './' : '/'),
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'app/public/index.html'),
        filename: 'index.html',
        inject: true,
        templateParameters: () => resolveClientEnv(true, cliEnv),
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, '../public'),
            to: path.resolve(__dirname, distOutputPath),
            noErrorOnMissing: true,
          },
        ],
      }),
      isProd &&
        new MiniCssExtractPlugin({
          filename: 'css/main.css',
          chunkFilename: 'css/[name].css',
        }),
      new CleanWebpackPlugin(),
    ].filter(Boolean),
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
            },
          },
        },
        {
          test: /\.css$/,
          include: [path.resolve(__dirname, '../node_modules')],
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.css$/,
          exclude: [path.resolve(__dirname, '../node_modules')],
          use: [
            extractOrStyleLoaderConfig,
            'css-loader',
            getPostcssLoaderConfig(true),
          ],
        },
        {
          test: /\.less$/,
          use: [
            classNamesConfig,
            extractOrStyleLoaderConfig,
            cssLoaderConfig,
            getPostcssLoaderConfig(true),
            lessLoaderConfig,
          ],
        },
        {
          test: /\.(png|jpg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name]-[hash][ext][query]',
          },
        },
        {
          test: /\.svg$/,
          use: ['@svgr/webpack'],
        },
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          type: 'asset/resource',
          generator: {
            filename: 'iconfont/[name][ext][query]',
          },
        },
      ],
    },
    optimization: {
      runtimeChunk: 'single',
      minimize: isProd,
      usedExports: true,
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        minSize: 100000,
        minChunks: 2,
        maxAsyncRequests: 20,
        maxInitialRequests: 6,
        cacheGroups: {
          'vendor-icons': {
            test: /lucide-react/,
            name: 'vendor-icons',
            priority: 20,
          },
          'vendor-monaco': {
            test: /monaco-editor/,
            name: 'vendor-monaco',
            priority: 20,
          },
          'vendor-react': {
            test: /[\\/]node_modules[\\/](react-dom|react[\\/]|react-router)/,
            name: 'vendor-react',
            priority: 15,
          },
          'vendor-ui': {
            test: /[\\/]node_modules[\\/](@radix-ui|class-variance-authority|clsx|tailwind-merge)/,
            name: 'vendor-ui',
            priority: 15,
          },
          'vendor-markdown': {
            test: /[\\/]node_modules[\\/](react-markdown|remark|rehype|unified|mdast|hast|micromark|@uiw\/react-md-editor)/,
            name: 'vendor-markdown',
            priority: 15,
          },
        },
      },
    },
  };

  return isProd ? webpackConfig : smp.wrap(webpackConfig);
};