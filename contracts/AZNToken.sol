// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AZN Token — AYZEN Platform Token
 * @notice ERC20 token deployed on Base ecosystem
 * @dev Total supply: 1,000,000,000 AZN
 *      Network: Base (Chain ID: 8453)
 */
contract AZNToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // Allocation percentages (out of 1000 for precision)
    uint256 public constant COMMUNITY_ALLOC = 400; // 40% — airdrops, rewards
    uint256 public constant TEAM_ALLOC = 150;       // 15% — team & advisors (2yr vesting)
    uint256 public constant TREASURY_ALLOC = 200;   // 20% — protocol treasury
    uint256 public constant LIQUIDITY_ALLOC = 150;  // 15% — DEX liquidity
    uint256 public constant ECOSYSTEM_ALLOC = 100;  // 10% — grants & partnerships

    bool public tradingEnabled = false;
    mapping(address => bool) public isExcludedFromRestrictions;

    event TradingEnabled(uint256 timestamp);
    event TokensMinted(address indexed to, uint256 amount, string reason);

    constructor(
        address treasury,
        address team,
        address liquidity,
        address ecosystem
    )
        ERC20("AYZEN Token", "AZN")
        ERC20Permit("AYZEN Token")
        Ownable(msg.sender)
    {
        require(treasury != address(0), "Zero treasury");
        require(team != address(0), "Zero team");
        require(liquidity != address(0), "Zero liquidity");
        require(ecosystem != address(0), "Zero ecosystem");

        // Community / airdrop pool — stays in owner/deployer for distribution
        uint256 communityAmount = (MAX_SUPPLY * COMMUNITY_ALLOC) / 1000;
        _mint(msg.sender, communityAmount);
        emit TokensMinted(msg.sender, communityAmount, "community_airdrops");

        // Team allocation
        uint256 teamAmount = (MAX_SUPPLY * TEAM_ALLOC) / 1000;
        _mint(team, teamAmount);
        emit TokensMinted(team, teamAmount, "team");

        // Treasury
        uint256 treasuryAmount = (MAX_SUPPLY * TREASURY_ALLOC) / 1000;
        _mint(treasury, treasuryAmount);
        emit TokensMinted(treasury, treasuryAmount, "treasury");

        // Liquidity
        uint256 liquidityAmount = (MAX_SUPPLY * LIQUIDITY_ALLOC) / 1000;
        _mint(liquidity, liquidityAmount);
        emit TokensMinted(liquidity, liquidityAmount, "liquidity");

        // Ecosystem
        uint256 ecosystemAmount = (MAX_SUPPLY * ECOSYSTEM_ALLOC) / 1000;
        _mint(ecosystem, ecosystemAmount);
        emit TokensMinted(ecosystem, ecosystemAmount, "ecosystem");

        // Exclude key addresses from trading restrictions
        isExcludedFromRestrictions[msg.sender] = true;
        isExcludedFromRestrictions[treasury] = true;
        isExcludedFromRestrictions[liquidity] = true;
    }

    function enableTrading() external onlyOwner {
        tradingEnabled = true;
        emit TradingEnabled(block.timestamp);
    }

    function setExcluded(address account, bool excluded) external onlyOwner {
        isExcludedFromRestrictions[account] = excluded;
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        if (!tradingEnabled) {
            require(
                from == address(0) ||
                isExcludedFromRestrictions[from] ||
                isExcludedFromRestrictions[to],
                "AZN: Trading not yet enabled"
            );
        }
        super._update(from, to, value);
    }

    /**
     * @notice Airdrop tokens to multiple recipients in one tx
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts (wei)
     */
    function airdrop(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }
}
