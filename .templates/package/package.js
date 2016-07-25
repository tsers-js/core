module.exports = {
  after: function (srcPath, distPath, variables, utils) {
    utils.Shell.cd(distPath + "/packages/" + variables.name)
    utils.Shell.exec("npm run update")
    utils.Shell.exec("npm i")
  }
}
