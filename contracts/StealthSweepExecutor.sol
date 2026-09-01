// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StealthSweepExecutor
/// @notice Minimal EIP-7702 delegate for SPONSORED native-ETH sweeps of a
/// stealth address.
///
/// A stealth payment lands on a fresh EOA that holds ETH but no gas. Sending it
/// gas from a linked wallet would de-anonymise the address. Instead, the stealth
/// EOA signs an EIP-7702 authorization delegating to this contract, plus an
/// EIP-712 `Sweep` authorization. A sponsor then submits a single type-4
/// transaction (authorizationList + call) and PAYS THE GAS; this code — running
/// in the EOA's context, so `address(this)` is the stealth EOA — verifies the
/// signature was made by the EOA itself and forwards the funds.
///
/// Testnet demo scope. Not audited. Single-purpose: native ETH only.
contract StealthSweepExecutor {
    bytes32 private constant SWEEP_TYPEHASH =
        keccak256("Sweep(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev Storage lives on the EOA's account under EIP-7702; each stealth EOA
    /// is single-use so nonces never collide across identities.
    mapping(uint256 => bool) public usedNonce;

    event Swept(address indexed to, uint256 amount, uint256 nonce);

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("GhostNameSweep")),
                keccak256(bytes("1")),
                block.chainid,
                address(this) // == the stealth EOA under EIP-7702
            )
        );
    }

    /// @notice Sweep `amount` wei to `to`, authorized by the EOA's signature.
    /// Callable by anyone (the sponsor); only a signature from the EOA itself
    /// passes. The sponsor pays gas.
    function sweep(
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(!usedNonce[nonce], "nonce used");

        bytes32 structHash = keccak256(abi.encode(SWEEP_TYPEHASH, to, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
        require(_recover(digest, signature) == address(this), "bad sig");

        usedNonce[nonce] = true;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send failed");
        emit Swept(to, amount, nonce);
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(digest, v, r, s);
    }

    receive() external payable {}
}
