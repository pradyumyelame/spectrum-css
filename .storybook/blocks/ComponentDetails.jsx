import { useOf } from '@storybook/blocks';
import { ResetWrapper } from "@storybook/components";
import { styled } from "@storybook/theming";
import React, { useEffect, useState } from "react";
import { Code } from "./Typography";
import { fetchToken } from "./utilities.js";

export const DList = styled.dl`
	display: grid;
	grid-template-columns: max-content 1fr;
	column-gap: 20px;
	row-gap: 14px;
	padding-block: 0.75rem;
	margin-block: 0.5rem 2.5rem;
	border-block: ${props => !props.skipBorder ? "1px solid hsla(203deg, 50%, 30%, 15%)" : "0"};

	& & {
		border-block: 0px;
		margin-block: 0;
		padding-inline-start: 0.75rem;
		padding-block-start: 0.25rem;
	}

	details > & {
		margin-inline-start: 12px;
	}
`;

export const DTerm = styled.dt`
	font-weight: ${props => props.theme.typography.weight.bold ?? "bold"};
	padding: 0;
	margin: 0;
	font-size: ${props => props.theme.typography.size.s};
`;

export const Details = styled.details`
	cursor: pointer;
	grid-column: 1 / 3;
	padding: 0;

	&[open] > summary::before {
		transform: rotate(90deg);
	}
`;

export const Summary = styled.summary`
	display: inline-flex;
	align-items: center;
	font-weight: ${props => props.theme.typography.weight.bold ?? "bold"};
	padding: 0;
	padding-block-end: 0.75rem;
	margin: 0;
	font-size: ${props => props.theme.typography.size.s};
	list-style: none;

	&::-webkit-details-marker {
		display: none;
	}

	&::before {
		content: '';
		width: 10px;
		height: 10px;
		background-image: url('data:image/svg+xml,<svg focusable="false" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M3 9.95a.875.875 0 0 1-.615-1.498L5.88 5 2.385 1.547A.875.875 0 0 1 3.615.302L7.74 4.377a.876.876 0 0 1 0 1.246L3.615 9.698A.87.87 0 0 1 3 9.95"></path></svg>');
		background-size: cover;
		margin-inline-end: .75em;
		transition: 0.2s;
	}
`;

export const DDefinition = styled.dd`
	font-style: normal;
	padding: 0;
	margin: 0;
	font-size: ${props => props.theme.typography.size.s};
`;

export const StatusLight = styled.span(({ variant = "positive", ...props }) => `
	border-radius: 50%;
	vertical-align: middle;
	/* Scale this in relation to the typography */
	block-size: 0.6rem;
	inline-size: 0.6rem;
	background-color: ${fetchToken(`${variant}-visual-color`)};
	display: inline-block;
	line-height: 2;
	margin-inline-end: ${["l", "xl"].includes(props.size) ? 10 : 8}px;
	margin-block-end: 1px;
`);

const VersionDetails = ({ tag, data = {}, isDeprecated = false, skipDate = false, skipLink = false }) => {
	let statusType = "notice";
	let statusMessage = "Not yet available on the npm registry.";

	if (isDeprecated) {
		statusType = "negative";
		statusMessage = "Deprecated; no longer maintained.";
	} else if (data.date) {
		statusType = "positive";
		statusMessage = "Available on the npm registry.";
	}

	if (!isDeprecated && tag !== "latest") {
		statusType = "notice";
		statusMessage = `Available on the npm registry but not recommended for production use.`;
	}

	if (tag === "local") {
		statusType = "negative";
		statusMessage = `Not yet published to the npm registry.`;
	}

	return (
		<>
			<StatusLight variant={statusType} title={statusMessage}/>
			{!skipLink && data.link ? <a href={data.link} rel="noopener noreferrer">{data.version}</a> : data.version}
			{!skipDate && data.date ? ` ${data.date}` : ""}
		</>
	);
};

/**
 * Process the npm data to determine the versions to display.
 * @param {object>} storyMeta
 * @param {object} npmData
 * @returns
 */
function processReleaseData(storyMeta, npmData) {
	console.log("Processing release data", npmData);
	const previewURL = "https://www.npmjs.org/package/";

	const packageJson = storyMeta?.csfFile?.meta?.parameters?.packageJson ?? {};
	const ignoredTags = storyMeta?.csfFile?.meta?.parameters?.ignoredTags ?? [];

	const tags = [
		// Force "local" to be included in the list because we won't fetch it from npm
		// but we want to show it in the list of tags
		"local",
		...Object.keys(npmData?.["dist-tags"] ?? {})
	].filter(tag => !ignoredTags.includes(tag));

	// Create a robust fallback stack to capture the version number
	const fallbackVersion = packageJson?.version ?? storyMeta?.csfFile?.meta?.parameters?.componentVersion;

	const mapVersions = new Map();
	for (const tag of tags) {
		let version = npmData?.versions?.[npmData?.["dist-tags"]?.[tag]]?.version;
		let date = npmData?.time?.[npmData?.["dist-tags"]?.[tag]] ? "published " + new Date(npmData?.time?.[npmData?.["dist-tags"]?.[tag]]).toLocaleDateString("en-US", {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
		}) : null;
		const link = npmData?.["dist-tags"]?.[tag] ? `${previewURL}${packageJson.name}/v/${npmData?.["dist-tags"]?.[tag]}` : null;

		// Prefer the version from the package.json file if this is the "local" tag
		if (tag === "local") {
			version = fallbackVersion;
			date = "unpublished";
		}

		mapVersions.set(tag, {
			version,
			date,
			link
		});
	}

	const allVersions = [...mapVersions.entries()].sort(([aTag, a], [bTag, b]) => {
		// Sort the local tag to the top, followed by the latest tag
		// then sort the rest of the tags by date in descending order
		if (aTag === "local") return -1;
		if (bTag === "local") return 1;
		if (aTag === "latest") return -1;
		if (bTag === "latest") return 1;
		return new Date(b.date) - new Date(a.date);
	});

	// Remove the local tag from the list if the latest tag is available and it's larger than the local tag using semver
	if (tags.includes("local") && tags.includes("latest")) {
		const localVersion = allVersions.find(([tag]) => tag === "local")?.[1]?.version;
		const latestVersion = allVersions.find(([tag]) => tag === "latest")?.[1]?.version;
		if (localVersion && latestVersion && localVersion === latestVersion) {
			allVersions.splice(allVersions.findIndex(([tag]) => tag === "local"), 1);
		} else if (localVersion && latestVersion && localVersion !== latestVersion) {
			// Check if the local version is a lower semver than the latest version
			const localSemver = localVersion.split(".");
			const latestSemver = latestVersion.split(".");
			const localMajor = parseInt(localSemver[0]);
			const latestMajor = parseInt(latestSemver[0]);
			if (localMajor < latestMajor) {
				allVersions.splice(allVersions.findIndex(([tag, data]) => tag === "local"), 1);
			} else if (localMajor === latestMajor) {
				const localMinor = parseInt(localSemver[1]);
				const latestMinor = parseInt(latestSemver[1]);
				if (localMinor < latestMinor) {
					allVersions.splice(allVersions.findIndex(([tag, data]) => tag === "local"), 1);
				} else if (localMinor === latestMinor) {
					const localPatch = parseInt(localSemver[2]);
					const latestPatch = parseInt(latestSemver[2]);
					if (localPatch < latestPatch) {
						allVersions.splice(allVersions.findIndex(([tag, data]) => tag === "local"), 1);
					}
				}
			}
		}
	}

	// A boolean to determine if the local version should be shown based on if it still exists in the list of all versions
	const showLocalVersion = allVersions.find(([tag]) => tag === "local");

	return {
		showLocalVersion,
		allVersions,
	};
}

function initCache(key) {
	const [cache, setCache] = useState(JSON.parse(localStorage.getItem(key)) ?? {});

	useEffect(() => {
		localStorage.setItem(key, JSON.stringify(cache));
	}, [key, cache]);

	return [cache, setCache];
}

function fetchNpmData(packageName, setnpmData, setIsLoading) {
	const [cache, setCache] = initCache(packageName);

	// Capture the npm data for the component from the registry
	useEffect(() => {
		if (typeof cache === "object" && Object.keys(cache).length > 0) {
			console.log(`Use cached npm data for ${packageName}`);
			setnpmData(cache);
			setIsLoading(false);
			return;
		}

		console.log(`Fetching npm data for ${packageName}`);
		fetch("https://registry.npmjs.org/" + packageName).then(async (response) => {
			if (!response.ok) {
				throw new Error(`Failed to fetch npm data for ${packageName}`);
			}

			const json = await response.json();

			if (!json) {
				throw new Error(`Failed to fetch npm data for ${packageName}`);
			}

			setnpmData(json);
			setCache(json);
			setIsLoading(false);
		}).catch((error) => {
			console.error(error?.message ?? error);
		});
	}, [cache, setCache, packageName, setnpmData, setIsLoading]);
}

/**
 * Displays the current version number of the component. The version is read from
 * the component's parameters, where it was sourced from the package.json file.
 *
 * Also displays a component status of "deprecated" if it is set in the story's
 * parameters.
 *
 * Usage of this doc block within MDX template(s):
 *  <ComponentDetails />
 */
export const ComponentDetails = () => {
	const storyMeta = useOf('meta');

	const isDeprecated = storyMeta?.csfFile?.meta?.parameters?.status?.type == "deprecated";
	const packageJson = storyMeta?.csfFile?.meta?.parameters?.packageJson ?? {};

	if (!packageJson?.name) return;

	const [isLoading, setIsLoading] = useState(true);
	const [npmData, setnpmData] = useState({});

	fetchNpmData(packageJson.name, setnpmData, setIsLoading);

	const { showLocalVersion, allVersions } = processReleaseData(storyMeta, npmData);

	return (
		<ResetWrapper>
			{ !isLoading ?
				<DList className="docblock-metadata sb-unstyled">
					{ isDeprecated
						?	<>
								<DTermDTerm key={'status'}>Status:</DTermDTerm>
								<DDefinition key={'status-data'}>Deprecated</DDefinition>
							</>
						: ""
					}
					{ showLocalVersion
						?	<>
								<DTerm>Local version:</DTerm>
								<DDefinition><VersionDetails tag={"local"} data={allVersions && allVersions.find(([tag]) => tag === "local")?.[1]} isDeprecated={isDeprecated} /></DDefinition>
							</>
						: <>
							<DTerm>Latest version:</DTerm>
							<DDefinition><VersionDetails tag={"latest"} data={allVersions && allVersions.find(([tag]) => tag === "latest")?.[1]} isDeprecated={isDeprecated} skipLink={true} /></DDefinition>
						</>
					}
				</DList>
			: ""}
		</ResetWrapper>
	);
};

/**
 * Displays the tagged releases of the component. The tagged releases are read from npm.
 *
 * Usage of this doc block within MDX template(s):
 *  <TaggedReleases />
 */
export const TaggedReleases = () => {
	const storyMeta = useOf('meta');

	const isDeprecated = storyMeta?.csfFile?.meta?.parameters?.status?.type == "deprecated";
	const packageJson = storyMeta?.csfFile?.meta?.parameters?.packageJson ?? {};

	const [isLoading, setIsLoading] = useState(true);
	const [npmData, setnpmData] = useState({});

	fetchNpmData(packageJson.name, setnpmData, setIsLoading);

	const { allVersions } = processReleaseData(storyMeta, npmData);

	return (
		<ResetWrapper>
			{ !isLoading ?
				<DList skipBorder={true} className="docblock-releases sb-unstyled">
					{ allVersions.filter(([tag]) => tag !== "local").map(([tag, data], idx) => (
						<>
							<DTerm>
								<Code style={{ display: "inline-block" }}>{tag}</Code>
							</DTerm>
							<DDefinition>
								<VersionDetails tag={tag} data={data} isDeprecated={isDeprecated} />
							</DDefinition>
						</>
					))}
				</DList>
				: ""
			}
		</ResetWrapper>
	);
};

export default ComponentDetails;