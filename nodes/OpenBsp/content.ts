import type { IDataObject } from 'n8n-workflow';

/**
 * Builders for the OpenBSP message `content` object (schema version "1").
 * Mirrors the OutgoingMessage union in
 * supabase/functions/_shared/types/message_types.ts.
 */

export function textContent(text: string): IDataObject {
	return { version: '1', type: 'text', kind: 'text', text };
}

export type MediaKind = 'image' | 'document' | 'audio' | 'video' | 'sticker';

export function mediaContent(
	kind: MediaKind,
	file: { uri: string; mime_type?: string; name?: string; size?: number },
	caption?: string,
): IDataObject {
	const fileObj: IDataObject = { uri: file.uri };
	if (file.mime_type) fileObj.mime_type = file.mime_type;
	if (file.name) fileObj.name = file.name;
	if (typeof file.size === 'number' && file.size > 0) fileObj.size = file.size;

	const content: IDataObject = {
		version: '1',
		type: 'file',
		kind,
		file: fileObj,
	};
	if (caption) content.text = caption;
	return content;
}

export function locationContent(data: {
	latitude: number;
	longitude: number;
	name?: string;
	address?: string;
}): IDataObject {
	const loc: IDataObject = {
		latitude: data.latitude,
		longitude: data.longitude,
	};
	if (data.name) loc.name = data.name;
	if (data.address) loc.address = data.address;
	return { version: '1', type: 'data', kind: 'location', data: loc };
}

export function contactsContent(contacts: IDataObject[]): IDataObject {
	return { version: '1', type: 'data', kind: 'contacts', data: contacts };
}

/**
 * Build a template content object. `bodyParameters` are positional {{1}}, {{2}}…
 * text values for the BODY component. When `componentsJson` is provided it is
 * used verbatim (advanced mode) and bodyParameters are ignored.
 */
export function templateContent(opts: {
	name: string;
	languageCode: string;
	bodyParameters?: string[];
	componentsJson?: IDataObject[];
}): IDataObject {
	let components: IDataObject[];

	if (opts.componentsJson && opts.componentsJson.length) {
		components = opts.componentsJson;
	} else if (opts.bodyParameters && opts.bodyParameters.length) {
		components = [
			{
				type: 'body',
				parameters: opts.bodyParameters.map((text) => ({ type: 'text', text })),
			},
		];
	} else {
		components = [];
	}

	return {
		version: '1',
		type: 'data',
		kind: 'template',
		data: {
			name: opts.name,
			language: { code: opts.languageCode },
			components,
		},
	};
}
