class Mcs < Formula
  desc "MCS (mcp-cs) — IEEE CS Universal Developer Operations, Diagnostics & AlgoJudge MCP Server"
  homepage "https://github.com/ieeecsopen/mcp-cs"
  url "https://registry.npmjs.org/mcp-cs/-/mcp-cs-2.2.0.tgz"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink "#{libexec}/lib/node_modules/mcp-cs/dist/index.js" => "mcs"
    bin.install_symlink "#{libexec}/lib/node_modules/mcp-cs/dist/index.js" => "mcp-cs"
  end

  test do
    system "#{bin}/mcs", "--help"
  end
end
