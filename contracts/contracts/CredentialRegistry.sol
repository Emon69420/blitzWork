// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CredentialRegistry
 * @notice On-chain professional credential registry for freelancers.
 *         Authorized issuers can grant credentials to freelancers.
 *         Anyone can verify credentials without trust assumptions.
 */
contract CredentialRegistry {
    struct Credential {
        uint256 id;
        string credentialType;
        string description;
        string issuerName;
        address issuerAddress;
        uint256 timestamp;
        bool isValid;
    }

    mapping(address => Credential[]) public credentials;
    mapping(address => bool) public authorizedIssuers;
    mapping(address => mapping(uint256 => uint256)) private credentialIndex;

    address public owner;
    uint256 private nextCredentialId;

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(
        address indexed freelancer,
        uint256 indexed credentialId,
        string credentialType,
        string issuerName,
        address indexed issuerAddress
    );
    event CredentialRevoked(address indexed freelancer, uint256 indexed credentialId);

    modifier onlyOwner() {
        require(msg.sender == owner, "CredentialRegistry: not owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "CredentialRegistry: not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "CredentialRegistry: zero address");
        require(!authorizedIssuers[issuer], "CredentialRegistry: already authorized");
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    function removeIssuer(address issuer) external onlyOwner {
        require(authorizedIssuers[issuer], "CredentialRegistry: not an issuer");
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    function issueCredential(
        address freelancer,
        string calldata credentialType,
        string calldata description,
        string calldata issuerName
    ) external onlyAuthorizedIssuer returns (uint256 credentialId) {
        require(freelancer != address(0), "CredentialRegistry: zero address");
        require(bytes(credentialType).length > 0, "CredentialRegistry: empty credential type");

        credentialId = nextCredentialId++;

        Credential memory newCredential = Credential({
            id: credentialId,
            credentialType: credentialType,
            description: description,
            issuerName: issuerName,
            issuerAddress: msg.sender,
            timestamp: block.timestamp,
            isValid: true
        });

        uint256 arrayIndex = credentials[freelancer].length;
        credentials[freelancer].push(newCredential);
        credentialIndex[freelancer][credentialId] = arrayIndex;

        emit CredentialIssued(freelancer, credentialId, credentialType, issuerName, msg.sender);
    }

    function revokeCredential(address freelancer, uint256 credentialId) external {
        uint256 idx = credentialIndex[freelancer][credentialId];
        Credential storage credential = credentials[freelancer][idx];

        require(credential.id == credentialId, "CredentialRegistry: credential not found");
        require(credential.isValid, "CredentialRegistry: already revoked");
        require(
            msg.sender == credential.issuerAddress || msg.sender == owner,
            "CredentialRegistry: not authorized to revoke"
        );

        credential.isValid = false;
        emit CredentialRevoked(freelancer, credentialId);
    }

    function getCredentials(address freelancer) external view returns (Credential[] memory) {
        return credentials[freelancer];
    }

    function verifyCredential(
        address freelancer,
        uint256 credentialId
    ) external view returns (bool isValid, Credential memory credential) {
        uint256 idx = credentialIndex[freelancer][credentialId];
        credential = credentials[freelancer][idx];
        require(credential.id == credentialId, "CredentialRegistry: credential not found");
        isValid = credential.isValid;
    }

    function getCredentialCount(address freelancer) external view returns (uint256) {
        return credentials[freelancer].length;
    }
}
