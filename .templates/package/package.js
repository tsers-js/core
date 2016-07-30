module.exports = {
  after: function (srcPath, distPath, variables, utils) {
    var sourcePath = srcPath + "/packages/{{name}}"
    var destPath = distPath + "/packages/" + variables.name

    utils.Shell.cp(sourcePath + "/.babelrc", destPath + "/")
    utils.Shell.cp(sourcePath + "/.npmignore", destPath + "/")
    utils.Shell.cd(destPath)
    utils.Shell.exec("npm run update")
    utils.Shell.exec("npm i")
  }
}
