class McpCs < Formula
  desc "IEEE CS Universal Developer Operations, Diagnostics & AlgoJudge MCP Server"
  homepage "https://github.com/ieeecsopen/mcp-cs"
  url "https://registry.npmjs.org/mcp-cs/-/mcp-cs-2.0.0.tgz"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/mcp-cs", "--version"
  end
end
