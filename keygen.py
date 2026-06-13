#!/usr/bin/env python3
"""keygen.py — Ethereum validator key generation wrapper

Wraps the staking-deposit-cli for automated validator key generation.
Supports mainnet and holesky networks.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────────

SUPPORTED_NETWORKS = {"mainnet", "holesky"}
DEPOSIT_CLI_VERSION = "2.7.0"
DEPOSIT_CLI_URLS = {
    "linux": (
        "https://github.com/ethereum/staking-deposit-cli/releases/download/"
        f"v{DEPOSIT_CLI_VERSION}/staking-deposit-cli-{DEPOSIT_CLI_VERSION}-linux-amd64.tar.gz"
    ),
    "darwin": (
        "https://github.com/ethereum/staking-deposit-cli/releases/download/"
        f"v{DEPOSIT_CLI_VERSION}/staking-deposit-cli-{DEPOSIT_CLI_VERSION}-darwin-amd64.tar.gz"
    ),
}

# ── Helpers ──────────────────────────────────────────────────────────────────


def get_platform():
    """Return platform key for binary download."""
    p = sys.platform
    if p.startswith("linux"):
        return "linux"
    if p == "darwin":
        return "darwin"
    print(f"Unsupported platform: {p}", file=sys.stderr)
    sys.exit(2)


def ensure_deposit_cli(cli_dir: Path) -> Path:
    """Download and extract staking-deposit-cli if not present."""
    exe_name = "deposit"
    cli_path = cli_dir / exe_name
    if cli_path.exists():
        return cli_path

    platform = get_platform()
    url = DEPOSIT_CLI_URLS.get(platform)
    if not url:
        print(f"No deposit CLI binary for platform: {platform}", file=sys.stderr)
        sys.exit(2)

    cli_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading staking-deposit-cli v{DEPOSIT_CLI_VERSION}...")

    # Download and extract
    tar_path = cli_dir / "deposit-cli.tar.gz"
    subprocess.run(["curl", "-L", "-o", str(tar_path), url], check=True, capture_output=True)
    subprocess.run(
        ["tar", "-xzf", str(tar_path), "-C", str(cli_dir), "--strip-components=1"],
        check=True,
        capture_output=True,
    )
    tar_path.unlink(missing_ok=True)

    if not cli_path.exists():
        print("Failed to extract deposit CLI", file=sys.stderr)
        sys.exit(2)

    cli_path.chmod(0o755)
    return cli_path


def generate_keys(
    deposit_cli: Path,
    network: str,
    num_validators: int,
    output_dir: Path,
    eth1_withdrawal_address: str = "",
    mnemonic_language: str = "english",
    existing_mnemonic: str = "",
) -> dict:
    """Run deposit CLI to generate validator keys."""
    cmd = [
        str(deposit_cli),
        "new-mnemonic" if not existing_mnemonic else "existing-mnemonic",
        "--num_validators", str(num_validators),
        "--mnemonic_language", mnemonic_language,
        "--chain", network,
        "--folder", str(output_dir),
    ]

    if eth1_withdrawal_address:
        cmd.extend(["--eth1_withdrawal_address", eth1_withdrawal_address])

    env = os.environ.copy()
    if existing_mnemonic:
        env["MNEMONIC"] = existing_mnemonic

    print(f"Generating {num_validators} validator key(s) for {network}...")
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)

    if result.returncode != 0:
        print(f"Key generation failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(2)

    # Locate output files
    keystores = sorted(output_dir.rglob("keystore-*.json"))
    deposit_files = sorted(output_dir.rglob("deposit_data-*.json"))

    return {
        "keystore_dir": str(output_dir),
        "keystore_files": [str(k) for k in keystores],
        "deposit_data_path": str(deposit_files[0]) if deposit_files else "",
        "mnemonic": "Save the mnemonic shown above securely",
    }


def generate_validator_keys(
    network: str = "mainnet",
    mnemonic_language: str = "english",
    num_validators: int = 1,
    output_dir: str = "./validator_keys",
    eth1_withdrawal_address: str = "",
    existing_mnemonic: str = "",
) -> dict:
    """Programmatic interface for validator key generation."""
    if network not in SUPPORTED_NETWORKS:
        raise ValueError(f"Unsupported network: {network}. Use: {SUPPORTED_NETWORKS}")

    out = Path(output_dir).resolve()
    cache_dir = Path.home() / ".cache" / "eth2-quickstart"
    deposit_cli = ensure_deposit_cli(cache_dir / "deposit-cli")

    return generate_keys(
        deposit_cli=deposit_cli,
        network=network,
        num_validators=num_validators,
        output_dir=out,
        eth1_withdrawal_address=eth1_withdrawal_address,
        mnemonic_language=mnemonic_language,
        existing_mnemonic=existing_mnemonic,
    )


# ── CLI ──────────────────────────────────────────────────────────────────────


def build_parser():
    parser = argparse.ArgumentParser(
        description="Generate Ethereum validator keys",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s --network mainnet --num-validators 1
  %(prog)s --network holesky --num-validators 3 --eth1-withdrawal-address 0xabc...
  %(prog)s --existing-mnemonic "word1 word2 ..." --num-validators 2
""",
    )
    parser.add_argument("--network", choices=sorted(SUPPORTED_NETWORKS), default="mainnet")
    parser.add_argument("--num-validators", type=int, default=1)
    parser.add_argument("--output-dir", default="./validator_keys")
    parser.add_argument("--eth1-withdrawal-address", default="")
    parser.add_argument("--mnemonic-language", default="english")
    parser.add_argument("--existing-mnemonic", default="", help="Recover from existing mnemonic")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    result = generate_validator_keys(
        network=args.network,
        mnemonic_language=args.mnemonic_language,
        num_validators=args.num_validators,
        output_dir=args.output_dir,
        eth1_withdrawal_address=args.eth1_withdrawal_address,
        existing_mnemonic=args.existing_mnemonic,
    )

    print("\n=== Key Generation Complete ===")
    print(f"Keystore directory: {result['keystore_dir']}")
    print(f"Keystore files: {len(result['keystore_files'])}")
    print(f"Deposit data: {result['deposit_data_path']}")
    print("\nNext steps:")
    print(f"  1. Upload deposit data to https://{'holesky.' if args.network == 'holesky' else ''}launchpad.ethereum.org")
    print("  2. Securely backup your mnemonic offline")
    print("  3. Import keystores: quickstart.py import-keys --keystore-dir", args.output_dir)


if __name__ == "__main__":
    main()
