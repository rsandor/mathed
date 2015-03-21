var gulp = require('gulp');
var browserify = require('browserify');
var transform = require('vinyl-transform');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var minifyCSS = require('gulp-minify-css');
var rename = require('gulp-rename');

var browserified = transform(function(filename) {
  var b = browserify(filename);
  return b.bundle();
});

gulp.task('js', function() {
  return gulp.src('./lib/mathed.js')
    .pipe(browserified)
    .pipe(gulp.dest('./dist/js/'))
    .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest('./dist/js/'));
});

gulp.task('css', function() {
  return gulp.src('./css/mathed.css')
    .pipe(gulp.dest('./dist/css/'))
    .pipe(minifyCSS())
    .pipe(rename({ extname: '.min.css' }))
    .pipe(gulp.dest('./dist/css/'));
});

gulp.task('fonts', function() {
  var sources = [
    './fonts/*.eot',
    './fonts/*.svg',
    './fonts/*.ttf',
    './fonts/*.woff'
  ];
  return gulp.src(sources).pipe(gulp.dest('./dist/fonts/'));
});

gulp.task('build', ['js', 'css', 'fonts']);