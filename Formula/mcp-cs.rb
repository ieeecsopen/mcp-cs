class McpCs < Formula
  desc "IEEE CS Universal Developer Operations, Diagnostics & AlgoJudge MCP Server"
  homepage "https://github.com/ieeecsopen/mcp-cs"
  url "https://registry.npmjs.org/mcp-cs/-/mcp-cs-2.1.0.tgz"
  sha256 "952f24df339544b105c65633fef9853f3c480c6a8fad46c26cb1faa7b3c60bd2"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink "#{libexec}/lib/node_modules/mcp-cs/dist/index.js" => "mcp-cs"
  end

  test do
    system "#{bin}/mcp-cs", "--help"
  end
end
