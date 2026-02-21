import React from "react";

const urlExact = /^(https?:\/\/[^\s]+)$/;

export function formatMessage(text: string) {
	const blocks = text.split(/\n\s*\n/);
	const urlRegex = /(https?:\/\/[^\s]+)/g;

	return blocks.map((block, i) => {
		const isHeader =
			block.length < 80 && !block.includes(".") && !block.includes(",");

		const parts = block.split(urlRegex).map((part, j) => {
			if (urlExact.test(part)) {
				return React.createElement(
					"a",
					{
						key: `link-${i}-${j}`,
						href: part,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-blue-400 underline hover:text-blue-300",
					},
					part
				);
			}

			return React.createElement("span", { key: `text-${i}-${j}` }, part);
		});

		if (isHeader) {
			return React.createElement(
				"h3",
				{ key: `h-${i}`, className: "text-lg font-semibold mb-2" },
				parts
			);
		}

		return React.createElement(
			"p",
			{ key: `p-${i}`, className: "mb-3" },
			parts
		);
	});
}
